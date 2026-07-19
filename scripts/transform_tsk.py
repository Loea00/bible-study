"""
Extract Treasury of Scripture Knowledge (TSK) cross-references from the
CrossWire SWORD module (DistributionLicense=Public Domain, confirmed via
https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=TSK and the
module's own mods.d/tsk.conf).

The module is a "zCom" commentary: verse-keyed, book-level zlib-compressed
blocks. There is no off-the-shelf reader for this format (pysword only
supports Bible-type "ztext" modules), so this hand-decodes the binary
index files:

  ot.bzs / nt.bzs  block index  -- 12 bytes/entry: offset(u32), compressed
                                    size(u32), uncompressed size(u32), all LE
  ot.bzz / nt.bzz  block data   -- zlib-compressed blocks, one per book
                                    (BlockType=BOOK), concatenated
  ot.bzv / nt.bzv  verse index  -- 10 bytes/entry: block number(u32),
                                    start offset(u32), length(u16), all LE

Verse *content* is walked self-calibrating rather than against a
precomputed versification table: every chapter is preceded by exactly one
"outline" entry whose ThML starts `<scripRef passage="Ge 2:1">` (a
self-identifying chapter/verse anchor used to make the chapter's summary
outline clickable) -- entries between one header and the next are that
chapter's verses 1..N in order, empty ones included. Real cross-reference
content is a *bare* `<scripRef>...</scripRef>` (no passage= attribute),
holding a ";"-separated list of citations that may carry book/chapter
forward across list items (see parse_citation_list below).

Usage: python3 scripts/transform_tsk.py
Produces data/tsk_cross_references.csv (from_verse_id,to_verse_start,to_verse_end)
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

MODULE_URL = "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/TSK.zip"
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY")

# Canonical 66-book USFM order, matching src/features/reading/books.ts.
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

# Full names, same order as above, for a last-resort prefix-match fallback
# when a citation's abbreviation doesn't match anything captured from the
# module's own chapter-header abbreviations.
OT_NAMES = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua",
    "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
    "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job",
    "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah",
    "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel",
    "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah",
    "Haggai", "Zechariah", "Malachi",
]
NT_NAMES = [
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians",
    "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians",
    "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy",
    "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter",
    "1 John", "2 John", "3 John", "Jude", "Revelation",
]
NAME_BY_CODE = dict(zip(OT_BOOKS + NT_BOOKS, OT_NAMES + NT_NAMES))

HEADER_RE = re.compile(r'<scripRef passage="([1-3]?\s?[A-Za-z]+)\s+(\d+):(\d+)"')
# Bare tag only (no passage= attribute) -- that's what marks real
# cross-reference content, as opposed to a chapter-outline header.
SCRIPREF_RE = re.compile(r"<scripRef>(.*?)</scripRef>", re.DOTALL)
TAG_RE = re.compile(r"<[^>]+>")


def fetch_chapter_counts():
    """
    {(book, chapter): max_verse} for the already-imported KJV verses table --
    used as ground truth for how many verse-slots each chapter should
    consume when walking the TSK module (see module docstring: the raw
    entry count is off from a naive "1 header + N verses" model by exactly
    2 stray leading slots per testament, so header detection alone
    isn't reliable enough to drive navigation).
    """
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
    if os.path.exists("data/TSK.zip"):
        with open("data/TSK.zip", "rb") as f:
            return f.read()
    os.makedirs("data", exist_ok=True)
    print(f"Downloading {MODULE_URL} ...")
    with urllib.request.urlopen(MODULE_URL) as resp:
        raw = resp.read()
    with open("data/TSK.zip", "wb") as f:
        f.write(raw)
    return raw


class ZCom:
    """Reads one testament's worth of a zCom module (bzs/bzz/bzv trio)."""

    def __init__(self, zf, prefix):
        self.bzs = zf.read(f"modules/comments/zcom/tsk/{prefix}.bzs")
        self.bzz = zf.read(f"modules/comments/zcom/tsk/{prefix}.bzz")
        self.bzv = zf.read(f"modules/comments/zcom/tsk/{prefix}.bzv")
        self._block_cache = {}

    def block(self, blocknum):
        if blocknum not in self._block_cache:
            off, csize, _usize = struct.unpack_from("<III", self.bzs, blocknum * 12)
            self._block_cache[blocknum] = zlib.decompress(self.bzz[off:off + csize])
        return self._block_cache[blocknum]

    def entry(self, i):
        """Raw bytes (or None if empty) for one verse-index slot."""
        blocknum, start, size = struct.unpack_from("<IIH", self.bzv, i * 10)
        if size == 0:
            return None
        return self.block(blocknum)[start:start + size]

    def count(self):
        return len(self.bzv) // 10


# Confirmed empirically (direct byte inspection around the Genesis/Exodus
# boundary) against the known-good KJV chapter/verse counts already in
# Supabase: each testament's index opens with this many throwaway slots
# before the first book's own book-intro slot begins.
LEADING_SLOTS = 3


def walk_testament(zcom, book_order, chapter_counts, testament_label, warnings):
    """
    Hybrid walk: book-intro slots are unconditional (exactly one per book,
    confirmed present for every book -- e.g. Exodus's is real prose, "The
    title of this Book is derived from the Septuagint..."), but a chapter's
    outline-header slot is NOT (most chapters have no editorial outline at
    all -- e.g. Exodus 1 goes straight into verse-1 content with no header
    slot in between). So each chapter peeks at the next entry: only consume
    it as a header if it actually looks like one (self-identifying
    `<scripRef passage="...">`); otherwise treat that same entry as verse 1.
    """
    verse_content = {}
    abbrev_to_code = {}
    cursor = LEADING_SLOTS
    total = zcom.count()

    for book in book_order:
        cursor += 1  # book-intro slot (unconditional; content varies, sometimes empty)
        chapters = sorted(c for (b, c) in chapter_counts if b == book)
        if not chapters:
            warnings.append(f"No chapter data for {book} in verses table -- skipped")
            continue
        for chapter in chapters:
            if cursor >= total:
                warnings.append(f"Ran off the end of {testament_label} data at {book} {chapter} (cursor {cursor}/{total})")
                break

            peek_raw = zcom.entry(cursor)
            peek_text = peek_raw.decode("utf-8", errors="replace") if peek_raw is not None else ""
            m = HEADER_RE.search(peek_text[:40]) if peek_raw is not None else None
            first_verse_raw = None
            if m:
                abbrev_to_code.setdefault(m.group(1), book)
                cursor += 1  # consume the header, verse 1 is the next slot
            else:
                first_verse_raw = peek_raw  # this slot IS verse 1, don't skip it

            n_verses = chapter_counts[(book, chapter)]
            for verse in range(1, n_verses + 1):
                if verse == 1 and not m:
                    raw = first_verse_raw
                else:
                    if cursor >= total:
                        warnings.append(f"Ran off the end of {testament_label} data inside {book} {chapter}:{verse}")
                        break
                    raw = zcom.entry(cursor)
                    cursor += 1
                if raw is not None:
                    verse_content[(book, chapter, verse)] = raw.decode("utf-8", errors="replace")

    if cursor != total:
        warnings.append(f"{testament_label}: consumed {cursor} of {total} slots (expected an exact match)")

    return verse_content, abbrev_to_code


def resolve_book(abbrev, abbrev_to_code):
    if abbrev in abbrev_to_code:
        return abbrev_to_code[abbrev]
    normalized = abbrev.replace(" ", "").lower()
    for a, code in abbrev_to_code.items():
        if a.replace(" ", "").lower() == normalized:
            return code
    for code, name in NAME_BY_CODE.items():
        if name.replace(" ", "").lower().startswith(normalized):
            return code
    return None


CITATION_BOOK_CH_V = re.compile(r"^([1-3]?\s?[A-Za-z]+)\.?\s+(\d+):(\d+)(?:-(\d+))?$")
CITATION_CH_V = re.compile(r"^(\d+):(\d+)(?:-(\d+))?$")
CITATION_V = re.compile(r"^(\d+)(?:-(\d+))?$")


def parse_citation_list(raw_list, source_book, source_chapter, abbrev_to_code, warnings):
    """
    ";"-separated citation groups, each optionally containing ","-separated
    verse continuations sharing that group's book/chapter. Returns a list of
    (to_book, to_chapter, verse_start, verse_end).
    """
    results = []
    book, chapter = source_book, source_chapter
    for group in raw_list.split(";"):
        group = group.strip()
        if not group:
            continue
        for i, part in enumerate(group.split(",")):
            part = part.strip()
            if not part:
                continue
            if i == 0:
                m = CITATION_BOOK_CH_V.match(part)
                if m:
                    resolved = resolve_book(m.group(1), abbrev_to_code)
                    if resolved is None:
                        warnings.append(f"Unresolved book abbrev {m.group(1)!r} near {source_book} {source_chapter}")
                        continue
                    book, chapter = resolved, int(m.group(2))
                    v1 = int(m.group(3))
                    v2 = int(m.group(4)) if m.group(4) else v1
                    results.append((book, chapter, v1, v2))
                    continue
                m = CITATION_CH_V.match(part)
                if m:
                    chapter = int(m.group(1))
                    v1 = int(m.group(2))
                    v2 = int(m.group(3)) if m.group(3) else v1
                    results.append((book, chapter, v1, v2))
                    continue
                m = CITATION_V.match(part)
                if m:
                    v1 = int(m.group(1))
                    v2 = int(m.group(2)) if m.group(2) else v1
                    results.append((book, chapter, v1, v2))
                    continue
                warnings.append(f"Unparsed citation part {part!r} near {source_book} {source_chapter}")
            else:
                # Comma-continuation: always a bare verse (or range) in the
                # book/chapter established by this group's first part.
                m = CITATION_V.match(part)
                if m:
                    v1 = int(m.group(1))
                    v2 = int(m.group(2)) if m.group(2) else v1
                    results.append((book, chapter, v1, v2))
                else:
                    warnings.append(f"Unparsed comma part {part!r} near {source_book} {source_chapter}")
    return results


def extract_cross_refs(verse_content, abbrev_to_code, warnings):
    rows = []
    for (book, chapter, verse), text in verse_content.items():
        for m in SCRIPREF_RE.finditer(text):
            inner = TAG_RE.sub("", m.group(1))
            if not inner.strip():
                continue
            from_id = f"{book}.{chapter}.{verse}"
            for to_book, to_chapter, v1, v2 in parse_citation_list(inner, book, chapter, abbrev_to_code, warnings):
                to_start = f"{to_book}.{to_chapter}.{v1}"
                to_end = f"{to_book}.{to_chapter}.{v2}"
                rows.append((from_id, to_start, to_end))
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
    # PSA onward is EXCLUDED for now: Psalms' titled psalms appear to use a
    # different verse-numbering convention than our own KJV table expects
    # (a well-known versification quirk -- some schemes count a psalm's
    # superscription as verse 1, others don't), which desyncs the walk's
    # cursor and cascades misalignment into every OT book after Psalms.
    # Verified correct (direct byte-position inspection, not just row
    # counts) through Job; Psalms through Malachi need a follow-up pass
    # before they can be trusted. See README/memory for the full note.
    OT_VERIFIED_CUTOFF = "JOB"
    ot_books_to_walk = OT_BOOKS[: OT_BOOKS.index(OT_VERIFIED_CUTOFF) + 1]
    excluded_ot_books = OT_BOOKS[OT_BOOKS.index(OT_VERIFIED_CUTOFF) + 1 :]

    ot_content, ot_abbrev = walk_testament(ot, ot_books_to_walk, chapter_counts, "OT", warnings)
    nt_content, nt_abbrev = walk_testament(nt, NT_BOOKS, chapter_counts, "NT", warnings)
    print(f"Excluded from this pass (Psalms-onward versification desync, needs follow-up): {excluded_ot_books}")

    abbrev_to_code = {**ot_abbrev, **nt_abbrev}

    print(f"OT: {len(ot_content)} verse entries with content, books seen: {sorted(set(b for b, c, v in ot_content))}")
    print(f"NT: {len(nt_content)} verse entries with content, books seen: {sorted(set(b for b, c, v in nt_content))}")
    print(f"Captured {len(abbrev_to_code)} book abbreviations from headers")

    missing_ot = set(OT_BOOKS) - set(ot_abbrev.values())
    missing_nt = set(NT_BOOKS) - set(nt_abbrev.values())
    if missing_ot or missing_nt:
        print(f"WARNING: books never seen in headers -- OT missing {missing_ot}, NT missing {missing_nt}")

    all_content = {**ot_content, **nt_content}
    rows = extract_cross_refs(all_content, abbrev_to_code, warnings)

    print(f"Extracted {len(rows)} cross-reference rows")
    print(f"{len(warnings)} parse warnings")
    for w in warnings[:30]:
        print("  WARN:", w)
    if len(warnings) > 30:
        print(f"  ... and {len(warnings) - 30} more")

    os.makedirs("data", exist_ok=True)
    with open("data/tsk_cross_references.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["from_verse_id", "to_verse_start", "to_verse_end"])
        writer.writerows(rows)
    print("Wrote data/tsk_cross_references.csv")


if __name__ == "__main__":
    main()
