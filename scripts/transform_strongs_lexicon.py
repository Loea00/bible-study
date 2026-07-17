import csv
import json
import re
import urllib.request

HEBREW_URL = "https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js"
GREEK_URL = "https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js"


def fetch_dict(url):
    with urllib.request.urlopen(url) as resp:
        text = resp.read().decode("utf-8")
    # Strip the `var xyz = ` / `module.exports = ...;` JS wrapper — the
    # object literal itself is valid JSON.
    start = text.index("{")
    end = text.rindex("}") + 1
    return json.loads(text[start:end])


def normalize_id(raw_id, prefix):
    # Source data zero-pads inconsistently ("H1" vs "H07225"); normalize to
    # no leading zeros so IDs match what word_tags will reference.
    digits = raw_id[1:].lstrip("0") or "0"
    return f"{prefix}{digits}"


def main():
    hebrew = fetch_dict(HEBREW_URL)
    greek = fetch_dict(GREEK_URL)

    with open("data/strongs_lexicon.csv", "w", newline="", encoding="utf-8") as out:
        writer = csv.writer(out)
        writer.writerow(
            ["strongs_id", "language", "lemma", "transliteration", "pronunciation", "derivation", "definition", "kjv_def"]
        )
        for raw_id, entry in hebrew.items():
            writer.writerow(
                [
                    normalize_id(raw_id, "H"),
                    "hebrew",
                    entry.get("lemma", ""),
                    entry.get("xlit", ""),
                    entry.get("pron", ""),
                    entry.get("derivation", ""),
                    entry.get("strongs_def", ""),
                    entry.get("kjv_def", ""),
                ]
            )
        for raw_id, entry in greek.items():
            writer.writerow(
                [
                    normalize_id(raw_id, "G"),
                    "greek",
                    entry.get("lemma", ""),
                    entry.get("translit", ""),
                    "",
                    entry.get("derivation", ""),
                    entry.get("strongs_def", ""),
                    entry.get("kjv_def", ""),
                ]
            )

    print(f"Hebrew entries: {len(hebrew)}, Greek entries: {len(greek)}")


if __name__ == "__main__":
    main()
