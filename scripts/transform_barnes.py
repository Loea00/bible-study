"""
Extract Barnes' Notes on the New Testament from the CrossWire SWORD module
(DistributionLicense=Public Domain, confirmed via the module's own
mods.d/barnes.conf). NT-only -- there is no OT edition of Barnes' Notes.

Binary format is plain zCom (confirmed via the standard divisibility check:
nt.czs is 3120 bytes -> 3120/12 = 260, matching the NT's known 260 total
chapters exactly; nt.czv is 82460 bytes -> 82460/10 = 8246, matching the
NT's known 8246 total verse slots), unlike JFB's zCom4. But barnes.conf
also declares BlockType=CHAPTER (not BOOK like MHCC/JFB/TSK) and
SourceType=ThML (not OSIS) -- both real structural differences that broke
the MHCC/JFB "seek a <chapter n="N"> header, then walk n_verses slots"
approach:

  - There's no dedicated header slot at all. A new chapter is signalled
    purely by the verse-index entry's blocknum incrementing by one, and
    -- confirmed by direct inspection -- one block corresponds to exactly
    one NT chapter, assigned sequentially in canonical book/chapter order
    (block 0 = Matthew 1, block 1 = Matthew 2, ... block 259 = Revelation
    22), which the 260-chapter/260-block match above guarantees holds
    globally, not just for the one Matthew transition actually inspected.

  - Entries within a chapter are NOT strictly one-per-verse. Barnes wrote
    genuinely uneven commentary -- e.g. Matthew 1 has 25 verses but only
    ~24 real content slots, because "Verses 2-16" got ONE combined entry
    while verse 23 got commented on TWICE (once inside a "Verses 22, 23"
    entry, once again on its own). Rather than reconstruct positional
    verse numbers via cursor arithmetic (unreliable here), every real
    Barnes entry's own text starts with an explicit label -- "Verse 4.",
    "Verses 22, 23.", "Ver 23." -- sometimes preceded by redundant title
    junk ("Matthew Verses 2-16 ... Verses 2-16. These verses...", or a
    free-text chapter header folded into verse 1's own slot: "MATTHEW
    Chapter 2 ... Verse 1. <i>When Jesus was born</i>..."). So verse
    ranges are parsed directly from content instead of from position: the
    LAST label match within each entry's leading ~250 characters is
    ground truth for that entry's verse_start/verse_end, and also the
    cut point where the real body text begins (dropping any repeated
    title/chapter-header junk that precedes it). Entries with no such
    label in their leading zone are front matter (the module opens with a
    book-wide "ORIGINAL PREFACE TO THE NOTES ON THE GOSPELS" and a longer
    "INTRODUCTION" before Matthew 1:1 even starts).

**Front matter is captured, not dropped.** It was originally discarded
outright (no "Verse N" label to key it to any specific verse), but that's
real content loss, not just a misplacement like MHCC/JFB's glued-to-
verse-1 problem -- Barnes' front matter isn't attached to any verse slot
at all, it's a run of unlabeled entries right at the very start of
Matthew's first block, before any labeled content begins.
`extract_front_matter()` walks entries in order and collects every
unlabeled one until the first labeled (real verse) entry is hit --
correct because front matter always precedes real content within a
block, never interleaves with it. Written to
`data/barnes_book_introductions.csv` as a single MAT row (Barnes' whole
NT front matter, structurally attached to Matthew since it's the first
book) for the shared `book_introductions` table (migration 0013).

One real content nuance found while checking this: the "Preface" and
"Introduction" entries aren't PURE essay prose -- each one's tail also
bundles in lettered footnote-style annotations for the verses that
follow ("(c) 'son of Abraham' Gen 22:18", "Verse 2. (d) 'begat Isaac'
Gen 21:2-5"), with no "Verse N." label of their own to key them to a
specific verse. Left bundled into the front matter as-is rather than
attempting to further decompose by footnote letter -> verse (a
meaningfully bigger, more speculative sub-task than "stop dropping this
content," which is what was actually asked for).

This sidesteps cursor-walking entirely: no LEADING_SLOTS to guess, no
seek-guard, no empty-slot-inside-a-chapter ambiguity (confirmed some
mid-chapter empty entries exist, e.g. Matthew 1 has two, and this design
just skips over them for free since they decode to no content and never
match a label).

Content markup is ThML, a new format for this project (previously OSIS
for MHCC/JFB, plain scripRef-style for TSK): `<br />` for line breaks,
`<i>...</i>` for italics, and `<scripRef version="Barnes"
passage="Mt 1:3">Mt 1:3</scripRef>` for cross-references, where `passage`
is short abbreviated text (not a resolved OSIS ref), so no citation
parsing is attempted here -- same tag-strip-to-plain-text treatment as
everywhere else.

Usage: python3 scripts/transform_barnes.py
Produces data/barnes_commentary.csv (source,verse_start,verse_end,body)
and data/barnes_book_introductions.csv (source,book,body)
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

MODULE_URL = "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Barnes.zip"
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY")

NT_BOOKS = [
    "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH",
    "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS",
    "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
]

TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")
LABEL_RE = re.compile(r"(?:Verses?|Ver)\.?\s+(\d+)\s*(?:[-,]\s*(\d+))?\.?", re.IGNORECASE)
LEADING_ZONE = 250


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
    if os.path.exists("data/Barnes.zip"):
        with open("data/Barnes.zip", "rb") as f:
            return f.read()
    os.makedirs("data", exist_ok=True)
    print(f"Downloading {MODULE_URL} ...")
    with urllib.request.urlopen(MODULE_URL) as resp:
        raw = resp.read()
    with open("data/Barnes.zip", "wb") as f:
        f.write(raw)
    return raw


class ZCom:
    """Plain zCom reader: 12-byte block index (offset:u32, csize:u32,
    usize:u32), 10-byte verse index (blocknum:u32, start:u32, length:u16)."""

    def __init__(self, zf, prefix):
        self.czs = zf.read(f"modules/comments/zcom/barnes/{prefix}.czs")
        self.czz = zf.read(f"modules/comments/zcom/barnes/{prefix}.czz")
        self.czv = zf.read(f"modules/comments/zcom/barnes/{prefix}.czv")
        self._block_cache = {}

    def block_count(self):
        return len(self.czs) // 12

    def block(self, blocknum):
        if blocknum not in self._block_cache:
            off, csize, _usize = struct.unpack_from("<III", self.czs, blocknum * 12)
            self._block_cache[blocknum] = zlib.decompress(self.czz[off:off + csize])
        return self._block_cache[blocknum]

    def entry(self, i):
        blocknum, start, length = struct.unpack_from("<IIH", self.czv, i * 10)
        if length == 0:
            return None, None
        return blocknum, self.block(blocknum)[start:start + length]

    def count(self):
        return len(self.czv) // 10


def build_block_chapter_map(book_order, chapter_counts):
    """One block per NT chapter, assigned sequentially in canonical
    book/chapter order -- confirmed by the module's own block count (260)
    exactly matching the NT's known 260 total chapters."""
    mapping = {}
    blocknum = 0
    for book in book_order:
        chapters = sorted(c for (b, c) in chapter_counts if b == book)
        for chapter in chapters:
            mapping[blocknum] = (book, chapter)
            blocknum += 1
    return mapping


def clean_text(raw_text):
    text = TAG_RE.sub(" ", raw_text)
    text = html.unescape(text)
    return WS_RE.sub(" ", text).strip()


def extract_verse_range_and_body(cleaned_text):
    """The last label match within the leading zone is ground truth for
    this entry's verse range, and also the cut point where real body text
    begins -- handles both a single label ("Verse 4. ...") and a repeated
    title-then-label ("Matthew Verses 2-16 ... Verses 2-16. ...") the
    same way. No match in the leading zone means this is front matter
    (Preface/Introduction), not a real verse comment."""
    zone = cleaned_text[:LEADING_ZONE]
    matches = list(LABEL_RE.finditer(zone))
    if not matches:
        return None
    last = matches[-1]
    v1 = int(last.group(1))
    v2 = int(last.group(2)) if last.group(2) else v1
    body = cleaned_text[last.end():].strip()
    if not body:
        return None
    return v1, v2, body


def extract_front_matter(zcom, block_map):
    """Collects the unlabeled entries at the very start of the module
    (Preface, Introduction) into one combined intro, stopping at the
    first labeled (real verse) entry -- front matter always precedes
    real content within a block, never interleaves with it."""
    parts = []
    for i in range(zcom.count()):
        blocknum, raw = zcom.entry(i)
        if raw is None:
            continue
        if block_map.get(blocknum) is None:
            continue
        cleaned = clean_text(raw.decode("utf-8", errors="replace"))
        if extract_verse_range_and_body(cleaned) is not None:
            break
        if cleaned:
            parts.append(cleaned)
    return "\n\n".join(parts)


def extract_entries(zcom, block_map, warnings):
    total_blocks = zcom.block_count()
    expected_blocks = max(block_map) + 1 if block_map else 0
    if total_blocks != expected_blocks:
        warnings.append(f"Block count mismatch: module has {total_blocks}, expected {expected_blocks}")

    rows = []
    for i in range(zcom.count()):
        blocknum, raw = zcom.entry(i)
        if raw is None:
            continue
        loc = block_map.get(blocknum)
        if loc is None:
            warnings.append(f"Entry {i} references unknown block {blocknum} -- skipped")
            continue
        book, chapter = loc
        cleaned = clean_text(raw.decode("utf-8", errors="replace"))
        parsed = extract_verse_range_and_body(cleaned)
        if parsed is None:
            continue
        v1, v2, body = parsed
        rows.append((book, chapter, v1, v2, body))
    return rows


def main():
    print("Fetching chapter/verse counts from the verses table...")
    chapter_counts = fetch_chapter_counts()
    nt_chapters = sum(1 for (b, _c) in chapter_counts if b in NT_BOOKS)
    print(f"Got {nt_chapters} NT chapters")

    raw_zip = download_module()
    zf = zipfile.ZipFile(io.BytesIO(raw_zip))
    nt = ZCom(zf, "nt")

    block_map = build_block_chapter_map(NT_BOOKS, chapter_counts)
    print(f"Built block map for {len(block_map)} chapters")

    front_matter = extract_front_matter(nt, block_map)
    print(f"Extracted {len(front_matter)} characters of front matter")

    warnings = []
    rows = extract_entries(nt, block_map, warnings)
    print(f"Extracted {len(rows)} commentary entries")

    print(f"{len(warnings)} parse warnings")
    for w in warnings[:30]:
        print("  WARN:", w)
    if len(warnings) > 30:
        print(f"  ... and {len(warnings) - 30} more")

    os.makedirs("data", exist_ok=True)
    with open("data/barnes_commentary.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["source", "verse_start", "verse_end", "body"])
        for book, chapter, v1, v2, body in rows:
            writer.writerow(["BARNES", f"{book}.{chapter}.{v1}", f"{book}.{chapter}.{v2}", body])
    print("Wrote data/barnes_commentary.csv")

    with open("data/barnes_book_introductions.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["source", "book", "body"])
        if front_matter:
            writer.writerow(["BARNES", "MAT", front_matter])
    print("Wrote data/barnes_book_introductions.csv")


if __name__ == "__main__":
    main()
