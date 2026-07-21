"""
Extract Jamieson-Fausset-Brown Bible Commentary (JFB) from the CrossWire
SWORD module (DistributionLicense=Public Domain, confirmed via the
module's own mods.d/jfb.conf).

Binary format is "zCom4", NOT plain "zCom" like TSK/MHCC -- a real
surprise caught by dividing the .bzv (verse index) file sizes by the
expected zCom entry size (10 bytes) and getting a non-integer result
(e.g. nt.bzv = 98952 bytes, 98952 / 10 = 9895.2). Confirmed zCom4 uses
12-byte verse-index entries (blocknum:u32, start:u32, length:u32 -- a
full 4-byte length instead of zCom's 2-byte length) by checking that
289380 / 12 = 24115 and 98952 / 12 = 8246, both exactly matching the
already-known OT/NT total slot counts from TSK/MHCC. The .bzs block
index (offset/csize/usize triples) is unchanged from plain zCom.

Content structure also differs from MHCC, which needed its own
special-casing here:
  - Section headers are `<title type="x-s3"><reference osisRef="...">Ge
    1:3-5</reference>. The First Day.</title>` -- a scripture-range plus
    a short descriptive title, NOT MHCC's "Chapter Outline" summary
    table (grepped 200 real entries for `<table`, found zero -- JFB
    apparently never uses that pattern, so that handling is dropped
    here rather than carried over unused).
  - Individual comments are `<hi type="bold">2. the earth was without
    form and void--</hi>` (verse number + quoted key phrase) or, for a
    second phrase within the same verse, just `<hi type="bold">the
    Spirit of God moved--</hi>` (no verse number). Unlike MHCC's
    "Verses N-M" label (pure noise, since we already track the verse
    range separately), these bold labels are genuinely useful inline
    content -- the quoted phrase tells you what part of the verse the
    following prose addresses -- so they're kept (just tag-stripped),
    not discarded.
  - `<div ... type="x-p"/>` start/end markers reliably delimit real
    paragraph boundaries in the source (confirmed by direct inspection:
    each bold-labeled sub-comment sits inside its own x-p pair), used
    directly as paragraph breaks instead of hand-rolled heuristics.

Still shares the same book-title-glued-onto-verse-1 issue and the same
empty-slot-before-header walk hazard MHCC had -- both handled by the
identical, format-agnostic fixes from transform_mhcc.py (see that
script's docstring for the full empty-slot bug writeup).

**Book introductions are split out, not left glued to verse 1.** JFB's
raw verse-1 entry for most books opens with a full scholarly introduction
essay -- Genesis's alone (really an intro to the whole Pentateuch) runs to
80KB, dwarfing the ~400-character median commentary entry. First tried
detecting this via the various title tags marking sub-sections within the
intro (`x-ms`, `x-IS`, `main`, `x-s`, `x-s2`) -- workable for most books
but genuinely inconsistent (Jude has no such title at all before its real
verse-1 commentary starts, just a bare `<hi type="bold">1. ...`).  The
actually-reliable signal, found afterward: every verse-1 entry with intro
content is wrapped start-to-finish in a single `<div type="x-milestone"
subType="x-preverse" sID="pvN"/> ... <div type="x-milestone"
subType="x-preverse" eID="pvN"/>` pair -- the module's own "this is
pre-verse content" marker, present (and reliable) whether or not the intro
happens to use titled sub-sections internally. `split_book_intro()` uses
this milestone pair directly; an entry that doesn't open with one (like 3
John, which has no intro of its own -- its text explicitly says "see my
Introduction before Second Epistle") is correctly left unsplit. Extracted
intros go to their own `data/jfb_book_introductions.csv`
(source,book,body) for a new `book_introductions` table (migration 0013)
-- shown once above chapter 1, not per-verse.

Usage: python3 scripts/transform_jfb.py
Produces data/jfb_commentary.csv (source,verse_start,verse_end,body) and
data/jfb_book_introductions.csv (source,book,body)
"""

import csv
import html
import io
import json
import os
import re
import struct
import urllib.request
import zipfile
import zlib

MODULE_URL = "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/JFB.zip"
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY")

OT_BOOKS = [
    "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
    "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO",
    "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO",
    "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
]
NT_BOOKS = [
    "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH",
    "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS",
    "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
]

HEADER_RE = re.compile(r'^<chapter n="(\d+)"')
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")

BOOK_TITLE_RE = re.compile(r'<title type="x-ms">.*?</title>', re.DOTALL)
SECTION_TITLE_RE = re.compile(r'<title type="x-s3">(.*?)</title>', re.DOTALL)
PARA_DIV_RE = re.compile(r'<div [^>]*type="x-p"/>')
PARA_BREAK = "\x00"

LEADING_SLOTS = 3


def fetch_chapter_counts():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set in the environment")
    counts = {}
    offset = 0
    page = 1000
    while True:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/verses?translation_code=eq.KJV&select=book,chapter,verse"
            f"&order=book,chapter,verse&limit={page}&offset={offset}",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        )
        rows = json.loads(urllib.request.urlopen(req).read())
        if not rows:
            break
        for row in rows:
            k = (row["book"], row["chapter"])
            counts[k] = max(counts.get(k, 0), row["verse"])
        offset += page
        if len(rows) < page:
            break
    return counts


def download_module():
    if os.path.exists("data/JFB.zip"):
        with open("data/JFB.zip", "rb") as f:
            return f.read()
    os.makedirs("data", exist_ok=True)
    print(f"Downloading {MODULE_URL} ...")
    with urllib.request.urlopen(MODULE_URL) as resp:
        raw = resp.read()
    with open("data/JFB.zip", "wb") as f:
        f.write(raw)
    return raw


class ZCom4:
    """Reads one testament's worth of a zCom4 module (bzs/bzz/bzv trio) --
    same block index as plain zCom, but 12-byte verse-index entries
    (blocknum, start, length -- all u32) instead of zCom's 10 bytes."""

    def __init__(self, zf, prefix):
        self.bzs = zf.read(f"modules/comments/zcom/jfb/{prefix}.bzs")
        self.bzz = zf.read(f"modules/comments/zcom/jfb/{prefix}.bzz")
        self.bzv = zf.read(f"modules/comments/zcom/jfb/{prefix}.bzv")
        self._block_cache = {}

    def block(self, blocknum):
        if blocknum not in self._block_cache:
            off, csize, _usize = struct.unpack_from("<III", self.bzs, blocknum * 12)
            self._block_cache[blocknum] = zlib.decompress(self.bzz[off:off + csize])
        return self._block_cache[blocknum]

    def entry(self, i):
        blocknum, start, length = struct.unpack_from("<III", self.bzv, i * 12)
        if length == 0:
            return None, None
        return (blocknum, start, length), self.block(blocknum)[start:start + length]

    def count(self):
        return len(self.bzv) // 12


def walk_testament(zcom, book_order, chapter_counts, testament_label, warnings):
    """Identical self-correcting seek-the-header walk to transform_mhcc.py
    -- see that script's docstring for why cumulative cursor arithmetic
    alone isn't safe."""
    verse_content = {}
    cursor = LEADING_SLOTS
    total = zcom.count()

    for book in book_order:
        chapters = sorted(c for (b, c) in chapter_counts if b == book)
        if not chapters:
            warnings.append(f"No chapter data for {book} in verses table -- skipped")
            continue
        for chapter in chapters:
            found = False
            seek_guard = 0
            while cursor < total:
                seek_guard += 1
                if seek_guard > 200:
                    warnings.append(f"Couldn't find a header for {book} {chapter} within 200 slots -- bailing")
                    break
                key, raw = zcom.entry(cursor)
                cursor += 1
                if raw is None:
                    continue
                text = raw.decode("utf-8", errors="replace")
                m = HEADER_RE.match(text)
                if m:
                    if int(m.group(1)) != chapter:
                        warnings.append(f"Expected header for {book} {chapter}, found n={m.group(1)} instead")
                    found = True
                    break
                warnings.append(f"Unexpected non-header content while seeking {book} {chapter}'s header -- treating as junk")
            if not found:
                warnings.append(f"Ran off the end of {testament_label} data seeking {book} {chapter}")
                break

            n_verses = chapter_counts[(book, chapter)]
            verse = 1
            guard = 0
            while verse <= n_verses:
                guard += 1
                if guard > n_verses * 4 + 20:
                    warnings.append(f"Too many extra header slots inside {book} {chapter} -- bailing to avoid an infinite loop")
                    break
                if cursor >= total:
                    warnings.append(f"Ran off the end of {testament_label} data inside {book} {chapter}:{verse}")
                    break
                key, raw = zcom.entry(cursor)
                cursor += 1
                if raw is None:
                    verse += 1
                    continue
                text = raw.decode("utf-8", errors="replace")
                if HEADER_RE.match(text):
                    continue
                verse_content[(book, chapter, verse)] = (key, text)
                verse += 1
            if cursor >= total:
                break
        if cursor >= total:
            warnings.append(f"Ran off the end of {testament_label} data at {book} -- remaining books skipped")
            break

    if cursor != total:
        warnings.append(f"{testament_label}: consumed {cursor} of {total} slots (expected an exact match)")

    return verse_content


def clean_text(raw_text):
    """Paragraph-separated plain text. Book-level intro titles become
    their own paragraph break (same fix as MHCC's "Genesis Genesis"
    duplication); section titles ("Ge 1:3-5. The First Day.") keep their
    text as a paragraph; the source's own `x-p` div markers are used
    directly as paragraph boundaries rather than guessed. Bold key-phrase
    labels ("2. the earth was...--") are genuinely useful content, so
    they're kept -- just tag-stripped like everything else."""
    text = BOOK_TITLE_RE.sub(PARA_BREAK, raw_text)
    text = SECTION_TITLE_RE.sub(lambda m: PARA_BREAK + TAG_RE.sub("", m.group(1)) + PARA_BREAK, text)
    text = PARA_DIV_RE.sub(PARA_BREAK, text)
    text = TAG_RE.sub(" ", text)
    text = html.unescape(text)
    paragraphs = [WS_RE.sub(" ", p).strip() for p in text.split(PARA_BREAK)]
    return "\n\n".join(p for p in paragraphs if p)


PREVERSE_OPEN_RE = re.compile(r'^<div type="x-milestone" subType="x-preverse" sID="([^"]+)"/>')
# Book/chapter-level headings ("THE FIRST BOOK OF MOSES...", "CHAPTER 1",
# "PSALM 1") that the source nests *inside* the x-preverse milestone
# alongside the real intro prose, but which should stay attached to the
# verse commentary that follows -- matching how x-s3 verse-range titles
# are already kept (not stripped) elsewhere in this script.
CONTENT_HEADING_RE = re.compile(r'<title type="main">|<title type="x-s">|<title type="x-s2">')


def split_book_intro(raw_text):
    """Splits a book-intro-glued verse-1 entry into (intro_raw,
    remainder_raw), using the module's own x-preverse milestone pair to
    find the outer boundary of intro-or-heading content -- reliable even
    for books with no title tags at all before verse 1 (e.g. Jude).
    Within that span, if a book/chapter heading is present, the cutoff
    moves earlier to just before it, so the heading stays with the real
    commentary rather than getting swept into the intro. Returns (None,
    raw_text) unchanged if the entry doesn't open with the milestone (no
    intro attached to this book, e.g. 3 John) or the matching close is
    missing (left unsplit rather than guessing wrong and losing content)."""
    open_match = PREVERSE_OPEN_RE.match(raw_text)
    if not open_match:
        return None, raw_text
    close_re = re.compile(r'<div type="x-milestone" subType="x-preverse" eID="' + re.escape(open_match.group(1)) + '"/>')
    close_match = close_re.search(raw_text, open_match.end())
    if not close_match:
        return None, raw_text
    heading_match = CONTENT_HEADING_RE.search(raw_text, open_match.end(), close_match.start())
    cutoff = heading_match.start() if heading_match else close_match.end()
    return raw_text[:cutoff], raw_text[cutoff:]


def extract_book_intros(verse_content, book_order, warnings):
    """Pulls the book-intro essay out of each book's (book, 1, 1) entry
    (where the walk placed it, since JFB has no separate slot for book
    front matter) and replaces that entry's text with just the real
    verse-1 commentary that follows it."""
    intros = {}
    for book in book_order:
        entry = verse_content.get((book, 1, 1))
        if entry is None:
            continue
        key, raw = entry
        intro_raw, remainder_raw = split_book_intro(raw)
        if intro_raw is None:
            if '<title type="x-ms">' in raw:
                warnings.append(f"{book}: found a book title but couldn't find an intro end boundary -- left unsplit")
            continue
        intros[book] = clean_text(intro_raw)
        verse_content[(book, 1, 1)] = (key, remainder_raw)
    return intros


def merge_ranges(verse_content, book_order, chapter_counts):
    rows = []
    for book in book_order:
        chapters = sorted(c for (b, c) in chapter_counts if b == book)
        for chapter in chapters:
            n_verses = chapter_counts[(book, chapter)]
            run_start = None
            run_key = None
            run_text = None
            for verse in range(1, n_verses + 1):
                entry = verse_content.get((book, chapter, verse))
                key, text = entry if entry else (None, None)
                if key is not None and key == run_key:
                    continue
                if run_start is not None:
                    rows.append((book, chapter, run_start, verse - 1, run_text))
                run_start = verse if key is not None else None
                run_key = key
                run_text = text
            if run_start is not None:
                rows.append((book, chapter, run_start, n_verses, run_text))
    return rows


def main():
    print("Fetching chapter/verse counts from the verses table...")
    chapter_counts = fetch_chapter_counts()
    print(f"Got {len(chapter_counts)} chapters, {sum(chapter_counts.values())} verses")

    raw_zip = download_module()
    zf = zipfile.ZipFile(io.BytesIO(raw_zip))

    ot = ZCom4(zf, "ot")
    nt = ZCom4(zf, "nt")

    warnings = []
    ot_content = walk_testament(ot, OT_BOOKS, chapter_counts, "OT", warnings)
    nt_content = walk_testament(nt, NT_BOOKS, chapter_counts, "NT", warnings)

    print(f"OT: {len(ot_content)} verse entries with content")
    print(f"NT: {len(nt_content)} verse entries with content")

    ot_intros = extract_book_intros(ot_content, OT_BOOKS, warnings)
    nt_intros = extract_book_intros(nt_content, NT_BOOKS, warnings)
    print(f"Split out {len(ot_intros)} OT + {len(nt_intros)} NT book introductions")

    ot_rows = merge_ranges(ot_content, OT_BOOKS, chapter_counts)
    nt_rows = merge_ranges(nt_content, NT_BOOKS, chapter_counts)
    print(f"Merged into {len(ot_rows)} OT + {len(nt_rows)} NT commentary entries")

    print(f"{len(warnings)} parse warnings")
    for w in warnings[:30]:
        print("  WARN:", w)
    if len(warnings) > 30:
        print(f"  ... and {len(warnings) - 30} more")

    os.makedirs("data", exist_ok=True)
    with open("data/jfb_commentary.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["source", "verse_start", "verse_end", "body"])
        for book, chapter, v1, v2, raw_text in ot_rows + nt_rows:
            writer.writerow(["JFB", f"{book}.{chapter}.{v1}", f"{book}.{chapter}.{v2}", clean_text(raw_text)])
    print("Wrote data/jfb_commentary.csv")

    with open("data/jfb_book_introductions.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["source", "book", "body"])
        for book in OT_BOOKS + NT_BOOKS:
            intro = ot_intros.get(book) or nt_intros.get(book)
            if intro:
                writer.writerow(["JFB", book, intro])
    print("Wrote data/jfb_book_introductions.csv")


if __name__ == "__main__":
    main()
