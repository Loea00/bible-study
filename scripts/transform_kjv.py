import csv

# Source book names (scrollmapper/bible_databases CSV) -> USFM 3-letter codes,
# matching the spec's OSIS-style verse_id convention (e.g. PSA.46.10).
BOOK_CODES = {
    "Genesis": "GEN", "Exodus": "EXO", "Leviticus": "LEV", "Numbers": "NUM",
    "Deuteronomy": "DEU", "Joshua": "JOS", "Judges": "JDG", "Ruth": "RUT",
    "I Samuel": "1SA", "II Samuel": "2SA", "I Kings": "1KI", "II Kings": "2KI",
    "I Chronicles": "1CH", "II Chronicles": "2CH", "Ezra": "EZR", "Nehemiah": "NEH",
    "Esther": "EST", "Job": "JOB", "Psalms": "PSA", "Proverbs": "PRO",
    "Ecclesiastes": "ECC", "Song of Solomon": "SNG", "Isaiah": "ISA", "Jeremiah": "JER",
    "Lamentations": "LAM", "Ezekiel": "EZK", "Daniel": "DAN", "Hosea": "HOS",
    "Joel": "JOL", "Amos": "AMO", "Obadiah": "OBA", "Jonah": "JON",
    "Micah": "MIC", "Nahum": "NAM", "Habakkuk": "HAB", "Zephaniah": "ZEP",
    "Haggai": "HAG", "Zechariah": "ZEC", "Malachi": "MAL", "Matthew": "MAT",
    "Mark": "MRK", "Luke": "LUK", "John": "JHN", "Acts": "ACT",
    "Romans": "ROM", "I Corinthians": "1CO", "II Corinthians": "2CO", "Galatians": "GAL",
    "Ephesians": "EPH", "Philippians": "PHP", "Colossians": "COL", "I Thessalonians": "1TH",
    "II Thessalonians": "2TH", "I Timothy": "1TI", "II Timothy": "2TI", "Titus": "TIT",
    "Philemon": "PHM", "Hebrews": "HEB", "James": "JAS", "I Peter": "1PE",
    "II Peter": "2PE", "I John": "1JN", "II John": "2JN", "III John": "3JN",
    "Jude": "JUD", "Revelation of John": "REV",
}


def transform(source_path, translation_code, writer):
    seen_books = set()
    with open(source_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            book_name = row["Book"]
            if book_name not in BOOK_CODES:
                raise ValueError(f"Unmapped book name: {book_name!r} in {source_path}")
            code = BOOK_CODES[book_name]
            seen_books.add(book_name)
            verse_id = f"{code}.{row['Chapter']}.{row['Verse']}"
            writer.writerow([verse_id, translation_code, code, row["Chapter"], row["Verse"], row["Text"]])
    missing = set(BOOK_CODES) - seen_books
    if missing:
        raise ValueError(f"{source_path} is missing books: {missing}")


def main():
    with open("data/verses_seed.csv", "w", newline="", encoding="utf-8") as out:
        writer = csv.writer(out)
        writer.writerow(["verse_id", "translation_code", "book", "chapter", "verse", "text"])
        transform("data/KJV.csv", "KJV", writer)
        transform("data/ASV.csv", "ASV", writer)


if __name__ == "__main__":
    main()
