"""
Extract Matthew Henry's Concise Commentary (MHCC) from the CrossWire SWORD
module (DistributionLicense=Public Domain, confirmed via the module's own
mods.d/mhcc.conf: "Public Domain--Copy Freely").

Same zCom binary format as TSK (see transform_tsk.py's docstring for the
byte layout) -- verse-keyed, book-level zlib-compressed blocks, decoded by
hand since no off-the-shelf reader exists for it.

Structurally different from TSK, though: each chapter opens with exactly
ONE non-verse `<chapter n="N" .../>` marker slot (not TSK's variable-count
`<scripRef passage=...>` outline anchors), and -- the important part --
Matthew Henry frequently comments on several consecutive verses in one
breath ("Verses 1-2", "Verses 3-5", ...). The zCom format has no native
concept of a verse *range* -- it's still a verse-indexed structure -- so
every verse covered by one commentary chunk gets its own index slot, and
all of them point at the exact same (block, offset, length) in the
underlying data. Confirmed by direct inspection: Genesis 1's slots 4-5
(verses 1-2) share one identical byte range, slots 6-8 (verses 3-5) share
another, etc. So the walk records each verse's (content_key, text) pair,
then a post-processing pass merges consecutive same-book-chapter verses
sharing an identical content_key back into the single logical entry they
actually are.

Usage: python3 scripts/transform_mhcc.py
Produces data/mhcc_commentary.csv (source,verse_start,verse_end,body)
"""

import csv
import io
import json
import os
import re
import struct
import urllib.request
import zipfile
import zlib

MODULE_URL = "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/MHCC.zip"
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
TABLE_RE = re.compile(r"<table\b.*?</table>", re.DOTALL)
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")

# Empirically confirmed (same as TSK, same osis2mod-generated slot layout):
# each testament's verse index opens with this many throwaway slots before
# the first book's own first chapter-marker slot begins.
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
    if os.path.exists("data/MHCC.zip"):
        with open("data/MHCC.zip", "rb") as f:
            return f.read()
    os.makedirs("data", exist_ok=True)
    print(f"Downloading {MODULE_URL} ...")
    with urllib.request.urlopen(MODULE_URL) as resp:
        raw = resp.read()
    with open("data/MHCC.zip", "wb") as f:
        f.write(raw)
    return raw


class ZCom:
    """Reads one testament's worth of a zCom module (bzs/bzz/bzv trio)."""

    def __init__(self, zf, prefix):
        self.bzs = zf.read(f"modules/comments/zcom/mhcc/{prefix}.bzs")
        self.bzz = zf.read(f"modules/comments/zcom/mhcc/{prefix}.bzz")
        self.bzv = zf.read(f"modules/comments/zcom/mhcc/{prefix}.bzv")
        self._block_cache = {}

    def block(self, blocknum):
        if blocknum not in self._block_cache:
            off, csize, _usize = struct.unpack_from("<III", self.bzs, blocknum * 12)
            self._block_cache[blocknum] = zlib.decompress(self.bzz[off:off + csize])
        return self._block_cache[blocknum]

    def entry(self, i):
        """(content_key, raw_bytes) for one verse-index slot, or (None, None) if empty.
        content_key identifies the underlying (block, offset, length) span --
        two verses sharing one commentary chunk share the same key."""
        blocknum, start, size = struct.unpack_from("<IIH", self.bzv, i * 10)
        if size == 0:
            return None, None
        return (blocknum, start, size), self.block(blocknum)[start:start + size]

    def count(self):
        return len(self.bzv) // 10


def walk_testament(zcom, book_order, chapter_counts, testament_label, warnings):
    """Each chapter's real verse content is preceded by its own
    `<chapter n="N">` marker slot -- but there can also be a run of
    completely EMPTY (None) index slots wedged in before that marker
    (confirmed by direct inspection: Job 38-42 each had exactly 17 empty
    slots ahead of their own header, unrelated to any chapter's real verse
    count). The original version of this walk counted every non-header
    slot as a verse, including that empty junk, which ate into a chapter's
    verse budget before its real content even started -- the chapter's
    walk then ran out of budget partway through its ACTUAL verses, leaving
    the remainder to be misread as the START of the next chapter. Silent,
    compounding, and exactly the kind of bug that produced Psalm 23:1
    showing Psalm 22's commentary.

    Fixed by making each chapter SEEK its own header explicitly (skipping
    empty slots without counting them) before reading exactly n_verses
    real verse slots -- self-correcting at every chapter boundary instead
    of trusting cumulative cursor arithmetic."""
    verse_content = {}
    cursor = LEADING_SLOTS
    total = zcom.count()

    for book in book_order:
        chapters = sorted(c for (b, c) in chapter_counts if b == book)
        if not chapters:
            warnings.append(f"No chapter data for {book} in verses table -- skipped")
            continue
        for chapter in chapters:
            # Seek this chapter's own header, skipping empty/junk slots.
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
                    continue  # a further mid-chapter marker -- not a verse, don't advance
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
    text = TABLE_RE.sub("", raw_text)
    text = TAG_RE.sub(" ", text)
    text = WS_RE.sub(" ", text).strip()
    return text


def merge_ranges(verse_content, book_order, chapter_counts):
    """Groups consecutive same-book-chapter verses sharing an identical
    content_key into one (verse_start, verse_end, body) row."""
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
                    continue  # still inside the current run
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

    ot = ZCom(zf, "ot")
    nt = ZCom(zf, "nt")

    warnings = []
    ot_content = walk_testament(ot, OT_BOOKS, chapter_counts, "OT", warnings)
    nt_content = walk_testament(nt, NT_BOOKS, chapter_counts, "NT", warnings)

    print(f"OT: {len(ot_content)} verse entries with content")
    print(f"NT: {len(nt_content)} verse entries with content")

    ot_rows = merge_ranges(ot_content, OT_BOOKS, chapter_counts)
    nt_rows = merge_ranges(nt_content, NT_BOOKS, chapter_counts)
    print(f"Merged into {len(ot_rows)} OT + {len(nt_rows)} NT commentary entries")

    print(f"{len(warnings)} parse warnings")
    for w in warnings[:30]:
        print("  WARN:", w)
    if len(warnings) > 30:
        print(f"  ... and {len(warnings) - 30} more")

    os.makedirs("data", exist_ok=True)
    with open("data/mhcc_commentary.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["source", "verse_start", "verse_end", "body"])
        for book, chapter, v1, v2, raw_text in ot_rows + nt_rows:
            writer.writerow(["MHCC", f"{book}.{chapter}.{v1}", f"{book}.{chapter}.{v2}", clean_text(raw_text)])
    print("Wrote data/mhcc_commentary.csv")


if __name__ == "__main__":
    main()
