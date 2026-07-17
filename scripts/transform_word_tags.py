import csv
import json
import re
import urllib.request
import xml.etree.ElementTree as ET

from transform_kjv import BOOK_CODES

SOURCE_URL = (
    "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/"
    "sources/en/KJVA/KJVA-osis.json"
)

# Split output OT/NT — 355k rows in one file is a much bigger import than
# anything so far; splitting means a failed/timed-out Table Editor import
# only costs retrying one chunk, not the whole thing.
NT_CODES = {
    "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH",
    "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS",
    "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
}

STRONG_TOKEN = re.compile(r"strong:([HG]\d+)")


def normalize_id(raw_id):
    prefix, digits = raw_id[0], raw_id[1:].lstrip("0") or "0"
    return f"{prefix}{digits}"


def parse_strongs(lemma_attr):
    if not lemma_attr:
        return []
    return [normalize_id(m) for m in STRONG_TOKEN.findall(lemma_attr)]


def extract_word_tags(verse_text):
    try:
        root = ET.fromstring(f"<root>{verse_text}</root>")
    except ET.ParseError:
        return None

    tags = []
    for position, w in enumerate(root.iter("w")):
        strongs_ids = parse_strongs(w.get("lemma", ""))
        if not strongs_ids:
            continue
        text = "".join(w.itertext())
        tags.append((position, text, strongs_ids, w.get("morph", "")))
    return tags


def main():
    with urllib.request.urlopen(SOURCE_URL) as resp:
        data = json.load(resp)

    parse_failures = 0
    rows_written = {"ot": 0, "nt": 0}
    header = ["verse_id", "translation_code", "position", "text", "strongs_ids", "morph"]

    with open("data/word_tags_ot.csv", "w", newline="", encoding="utf-8") as ot_out, open(
        "data/word_tags_nt.csv", "w", newline="", encoding="utf-8"
    ) as nt_out:
        ot_writer = csv.writer(ot_out)
        nt_writer = csv.writer(nt_out)
        ot_writer.writerow(header)
        nt_writer.writerow(header)

        for book in data["books"]:
            code = BOOK_CODES.get(book["name"])
            if code is None:
                continue  # apocryphal book, not in our 66-book canon
            writer = nt_writer if code in NT_CODES else ot_writer
            testament = "nt" if code in NT_CODES else "ot"
            for chapter in book["chapters"]:
                for verse in chapter["verses"]:
                    verse_id = f"{code}.{verse['chapter']}.{verse['verse']}"
                    tags = extract_word_tags(verse["text"])
                    if tags is None:
                        parse_failures += 1
                        continue
                    for position, text, strongs_ids, morph in tags:
                        writer.writerow([verse_id, "KJV", position, text, ",".join(strongs_ids), morph])
                        rows_written[testament] += 1

    print(f"OT rows: {rows_written['ot']}, NT rows: {rows_written['nt']}, parse failures: {parse_failures}")


if __name__ == "__main__":
    main()
