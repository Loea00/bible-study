"""
Extract Nave's Topical Bible from the CrossWire SWORD module
(DistributionLicense=Public Domain, confirmed via the module's own
mods.d/nave.conf).

This is a "zLD" module (compressed lexicon/dictionary) -- a different
binary format from TSK/MHCC's "zCom" (verse-keyed commentary blocks).
zLD is key-keyed: topics map to entries via a key file, not verses via a
versification walk. No off-the-shelf reader exists for this either, so
this hand-decodes the format from scratch (confirmed by direct byte
inspection, not documentation):

  dict.dat   key file -- repeating `KEY\r\n` + blocknum(u32 LE) +
             entryIndex(u32 LE) + `\r\n`, one per topic, already sorted
             alphabetically.
  dict.idx   parallel (offset, size) index into dict.dat by byte position
             (for binary-search lookup) -- not needed for a full extract,
             since dict.dat can just be walked sequentially.
  dict.zdx   block index -- 8 bytes/entry: offset(u32), compressed
             size(u32), both LE, one entry per blocknum. NOT the same
             shape as zCom's 12-byte block index (offset+csize+usize) --
             confirmed by 1424 % 12 != 0 but 1424 % 8 == 0 for this
             module's zdx, and decompression only succeeding with the
             8-byte reading. zLD apparently omits the uncompressed-size
             field zCom's bzs carries.
  dict.zdt   block data -- zlib-compressed blocks.

Each decompressed block itself opens with a small header: entry
count(u32 LE), then that many (offset:u32, length:u32) pairs -- entryIndex
from dict.dat indexes directly into this array -- followed by the
concatenated raw entry contents. Confirmed empirically: for the first
block, entry 0 (AARON)'s recorded offset (244) exactly matched where its
content started when searched for directly, and the header's leading
count field (30) accounted for the exact 4 + 30*8 = 244 byte gap.

Content markup is TEI, not OSIS -- but scripture references are *already
fully resolved* as `<ref osisRef="Exod.6.16-Exod.6.20">Ex 6:16-20</ref>`,
so unlike TSK's citation shorthand, no book/chapter-carry-forward parsing
is needed -- osisRef is read directly. Each entry is a set of `<lb/>`-
delimited lines, each with a descriptive label ("Marriage of", "Death and
burial of") followed by its own refs -- preserved as a `label` column
since it's genuine structure in the source, not just noise (this is how
Nave's own printed edition organizes each topic).

Usage: python3 scripts/transform_nave.py
Produces data/nave_topics.csv (topic,label,verse_start,verse_end)
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

MODULE_URL = "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Nave.zip"
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY")

# Standard OSIS book IDs (OSIS 2.1.1) -> this app's USFM-style codes
# (src/features/reading/books.ts).
OSIS_TO_USFM = {
    "Gen": "GEN", "Exod": "EXO", "Lev": "LEV", "Num": "NUM", "Deut": "DEU",
    "Josh": "JOS", "Judg": "JDG", "Ruth": "RUT", "1Sam": "1SA", "2Sam": "2SA",
    "1Kgs": "1KI", "2Kgs": "2KI", "1Chr": "1CH", "2Chr": "2CH", "Ezra": "EZR",
    "Neh": "NEH", "Esth": "EST", "Job": "JOB", "Ps": "PSA", "Prov": "PRO",
    "Eccl": "ECC", "Song": "SNG", "Isa": "ISA", "Jer": "JER", "Lam": "LAM",
    "Ezek": "EZK", "Dan": "DAN", "Hos": "HOS", "Joel": "JOL", "Amos": "AMO",
    "Obad": "OBA", "Jonah": "JON", "Mic": "MIC", "Nah": "NAM", "Hab": "HAB",
    "Zeph": "ZEP", "Hag": "HAG", "Zech": "ZEC", "Mal": "MAL",
    "Matt": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN", "Acts": "ACT",
    "Rom": "ROM", "1Cor": "1CO", "2Cor": "2CO", "Gal": "GAL", "Eph": "EPH",
    "Phil": "PHP", "Col": "COL", "1Thess": "1TH", "2Thess": "2TH",
    "1Tim": "1TI", "2Tim": "2TI", "Titus": "TIT", "Phlm": "PHM", "Heb": "HEB",
    "Jas": "JAS", "1Pet": "1PE", "2Pet": "2PE", "1John": "1JN",
    "2John": "2JN", "3John": "3JN", "Jude": "JUD", "Rev": "REV",
}

REF_RE = re.compile(r'<ref osisRef="([^"]+)">')
LB_SPLIT_RE = re.compile(r"<lb/>")
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


def fetch_chapter_counts():
    """{(book, chapter): max_verse} -- needed to expand whole-chapter refs
    like "Num.17" (no verse component) into a real verse_start/verse_end."""
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
    if os.path.exists("data/Nave.zip"):
        with open("data/Nave.zip", "rb") as f:
            return f.read()
    os.makedirs("data", exist_ok=True)
    print(f"Downloading {MODULE_URL} ...")
    with urllib.request.urlopen(MODULE_URL) as resp:
        raw = resp.read()
    with open("data/Nave.zip", "wb") as f:
        f.write(raw)
    return raw


def parse_key_file(dat_bytes):
    """Yields (topic, blocknum, entry_index) in file order (already
    alphabetically sorted)."""
    i = 0
    n = len(dat_bytes)
    while i < n:
        end = dat_bytes.index(b"\r\n", i)
        key = dat_bytes[i:end].decode("utf-8", errors="replace")
        blocknum, entry_index = struct.unpack_from("<II", dat_bytes, end + 2)
        yield key, blocknum, entry_index
        i = end + 2 + 8 + 2  # key + \r\n + 8 bytes + trailing \r\n


class ZLD:
    def __init__(self, zf, base):
        self.dat = zf.read(f"{base}.dat")
        self.idx = zf.read(f"{base}.idx")
        self.zdx = zf.read(f"{base}.zdx")
        self.zdt = zf.read(f"{base}.zdt")
        self._block_cache = {}

    def block(self, blocknum):
        if blocknum not in self._block_cache:
            off, csize = struct.unpack_from("<II", self.zdx, blocknum * 8)
            self._block_cache[blocknum] = zlib.decompress(self.zdt[off:off + csize])
        return self._block_cache[blocknum]

    def entry(self, blocknum, entry_index):
        block = self.block(blocknum)
        count = struct.unpack_from("<I", block, 0)[0]
        if entry_index >= count:
            return None
        offset, length = struct.unpack_from("<II", block, 4 + entry_index * 8)
        return block[offset:offset + length].decode("utf-8", errors="replace")


def parse_osis_ref(ref, chapter_counts, warnings, topic):
    """"Exod.6.16-Exod.6.20" / "Josh.21.4" / "Num.17" (whole chapter) ->
    (verse_start, verse_end) verse_id strings, or None if unparseable."""
    parts = ref.split("-")
    start = parts[0]
    end = parts[1] if len(parts) > 1 else parts[0]

    def resolve(osis, is_end):
        pieces = osis.split(".")
        book = OSIS_TO_USFM.get(pieces[0])
        if book is None:
            warnings.append(f"Unknown OSIS book {pieces[0]!r} in ref {ref!r} (topic {topic!r})")
            return None
        if len(pieces) == 1:
            # Whole book reference -- rare, not worth chasing further.
            return None
        chapter = int(pieces[1])
        if len(pieces) >= 3:
            verse = int(pieces[2])
        else:
            # Whole-chapter reference (e.g. "Num.17") -- expand to the
            # chapter's first or last verse depending on which side of
            # the range this is.
            n_verses = chapter_counts.get((book, chapter))
            if n_verses is None:
                warnings.append(f"No chapter data for {book} {chapter} (ref {ref!r}, topic {topic!r})")
                return None
            verse = n_verses if is_end else 1
        return f"{book}.{chapter}.{verse}"

    v1 = resolve(start, False)
    v2 = resolve(end, True)
    if v1 is None or v2 is None:
        return None
    return v1, v2


def extract_topic_rows(topic, content, chapter_counts, warnings):
    rows = []
    for line in LB_SPLIT_RE.split(content):
        refs = REF_RE.findall(line)
        if not refs:
            continue
        label_raw = line[: line.find("<ref")] if "<ref" in line else ""
        label = WS_RE.sub(" ", TAG_RE.sub("", label_raw)).strip(" →\n\t")
        for ref in refs:
            parsed = parse_osis_ref(ref, chapter_counts, warnings, topic)
            if parsed is None:
                continue
            v1, v2 = parsed
            rows.append((topic, label or None, v1, v2))
    return rows


def main():
    print("Fetching chapter/verse counts from the verses table...")
    chapter_counts = fetch_chapter_counts()
    print(f"Got {len(chapter_counts)} chapters")

    raw_zip = download_module()
    zf = zipfile.ZipFile(io.BytesIO(raw_zip))
    zld = ZLD(zf, "modules/lexdict/zld/nave/dict")

    topics = list(parse_key_file(zld.dat))
    print(f"Found {len(topics)} topic keys")

    warnings = []
    rows = []
    empty_topics = 0
    for topic, blocknum, entry_index in topics:
        content = zld.entry(blocknum, entry_index)
        if content is None:
            warnings.append(f"No content for topic {topic!r} (block {blocknum}, index {entry_index})")
            continue
        topic_rows = extract_topic_rows(topic, content, chapter_counts, warnings)
        if not topic_rows:
            empty_topics += 1
        rows.extend(topic_rows)

    print(f"Extracted {len(rows)} (topic, verse) rows across {len(topics)} topics")
    print(f"{empty_topics} topics produced no verse rows (pure cross-references/aliases, not chased further)")
    print(f"{len(warnings)} parse warnings")
    for w in warnings[:30]:
        print("  WARN:", w)
    if len(warnings) > 30:
        print(f"  ... and {len(warnings) - 30} more")

    os.makedirs("data", exist_ok=True)
    with open("data/nave_topics.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["topic", "label", "verse_start", "verse_end"])
        writer.writerows(rows)
    print("Wrote data/nave_topics.csv")


if __name__ == "__main__":
    main()
