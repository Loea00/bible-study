// Hand-written types mirroring the Phase 1 Supabase schema
// (supabase/migrations/0001_phase1_schema.sql). Regenerate with
// `supabase gen types typescript` once the project is linked, and
// this file can be replaced wholesale.
//
// NOTE: these must be `type`, not `interface` — supabase-js's generic
// query-result inference silently collapses to `never` when Row/Insert/
// Update reference a named interface instead of a type alias.

export type EntryType =
  | 'margin_note'
  | 'journal'
  | 'reflection'
  | 'templated_journal'
  | 'prayer_update'
  | 'word'
  | 'concern'
export type RefKind = 'anchor' | 'inline'
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

export type Entry = {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  entry_type: EntryType
  title: string | null
  body: string
  template_id: string | null
  template_responses: Record<string, unknown> | null
  anchor_start: string | null
  anchor_end: string | null
  tags: string[]
  session_id: string | null
  // Prayer-attached writing (spec-amendment-v1-2 §B2) — null for every
  // other entry_type.
  request_id: string | null
}

export type VerseReference = {
  id: string
  entry_id: string
  user_id: string
  verse_start: string
  verse_end: string
  position: number | null
  ref_kind: RefKind
  // Sub-verse span anchoring (spec amendment v1.1 §A2). Null across all
  // three = whole-verse reference (today's only case). Present = a precise,
  // translation-specific span within the verse.
  start_offset: number | null
  end_offset: number | null
  translation: string | null
}

export type ReadingSession = {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  passage_start: string | null
  passage_end: string | null
  last_position: string | null
}

export type Translation = {
  code: string
  name: string
  is_default: boolean
}

export type Verse = {
  verse_id: string
  translation_code: string
  book: string
  chapter: number
  verse: number
  text: string
}

// One highlight row is a group; `spans` covers every shape — a partial
// verse, a whole verse, multiple verses, or non-consecutive parts — in a
// single row (spec amendment v1.1 §A3). Phase 1 only ever writes single-span
// whole-verse groups (offsets null) until text-selection ships.
export type HighlightSpan = {
  verse_id: string
  start_offset: number | null
  end_offset: number | null
}

export type Highlight = {
  id: string
  user_id: string
  created_at: string
  color: HighlightColor
  translation: string | null
  spans: HighlightSpan[]
}

export type StrongsLexicon = {
  strongs_id: string
  language: 'hebrew' | 'greek'
  lemma: string
  transliteration: string | null
  pronunciation: string | null
  derivation: string | null
  definition: string | null
  kjv_def: string | null
}

export type WordTag = {
  id: string
  verse_id: string
  translation_code: string
  position: number
  text: string
  // Comma-separated, not a real array — see migration 0006's note on why.
  strongs_ids: string
  morph: string | null
}

export type PrayerRequestStatus = 'active' | 'ongoing' | 'answered' | 'archived'
export type PrayerVisibility = 'private' | 'shared' | 'group' | 'public'

export type PrayerList = {
  id: string
  user_id: string
  name: string
  sort_order: number
  created_at: string
}

// grounding is the cached AI scripture-grounding payload (spec-amendment
// v1.2 §B5, Phase 3) — untyped JSON for now since Layer 2 isn't built yet.
export type PrayerRequest = {
  id: string
  user_id: string
  list_id: string | null
  created_at: string
  title: string
  description: string
  status: PrayerRequestStatus
  answered_at: string | null
  answered_note: string | null
  visibility: PrayerVisibility
  grounding: Record<string, unknown> | null
  grounding_generated_at: string | null
}

// The one-tap "I prayed for this" — deliberately writing-free (spec
// §B2: "gestures, not thoughts").
export type PrayedMark = {
  id: string
  request_id: string
  user_id: string
  created_at: string
  session_id: string | null
}

// Treasury of Scripture Knowledge (spec §5.1 "TSK cross-references in
// panel"). to_verse_start/to_verse_end are both set even for a
// single-verse target (start = end) — same convention verse_references
// already uses for a single-verse span.
export type TskCrossReference = {
  id: string
  from_verse_id: string
  to_verse_start: string
  to_verse_end: string
}

// Public-domain commentaries (spec §102). `source` distinguishes which
// commentary a row belongs to (starting with 'MHCC' — Matthew Henry's
// Concise — more planned). verse_start/verse_end cover a range since
// commentators often comment on several consecutive verses at once.
export type CommentaryEntry = {
  id: string
  source: string
  verse_start: string
  verse_end: string
  body: string
}

export type Database = {
  public: {
    Tables: {
      entries: {
        Row: Entry
        Insert: Omit<Entry, 'id' | 'created_at' | 'updated_at' | 'request_id'> & {
          id?: string
          created_at?: string
          updated_at?: string
          request_id?: string | null
        }
        Update: Partial<Entry>
        Relationships: []
      }
      verse_references: {
        Row: VerseReference
        Insert: Omit<VerseReference, 'id' | 'start_offset' | 'end_offset' | 'translation'> & {
          id?: string
          start_offset?: number | null
          end_offset?: number | null
          translation?: string | null
        }
        Update: Partial<VerseReference>
        Relationships: []
      }
      reading_sessions: {
        Row: ReadingSession
        Insert: Omit<ReadingSession, 'id'> & { id?: string }
        Update: Partial<ReadingSession>
        Relationships: []
      }
      translations: {
        Row: Translation
        Insert: Translation
        Update: Partial<Translation>
        Relationships: []
      }
      verses: {
        Row: Verse
        Insert: Verse
        Update: Partial<Verse>
        Relationships: []
      }
      highlights: {
        Row: Highlight
        Insert: Omit<Highlight, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Highlight>
        Relationships: []
      }
      strongs_lexicon: {
        Row: StrongsLexicon
        Insert: StrongsLexicon
        Update: Partial<StrongsLexicon>
        Relationships: []
      }
      word_tags: {
        Row: WordTag
        Insert: Omit<WordTag, 'id'> & { id?: string }
        Update: Partial<WordTag>
        Relationships: []
      }
      prayer_lists: {
        Row: PrayerList
        Insert: Omit<PrayerList, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<PrayerList>
        Relationships: []
      }
      prayer_requests: {
        Row: PrayerRequest
        Insert: Omit<
          PrayerRequest,
          'id' | 'created_at' | 'status' | 'answered_at' | 'answered_note' | 'visibility' | 'grounding' | 'grounding_generated_at'
        > & {
          id?: string
          created_at?: string
          status?: PrayerRequestStatus
          answered_at?: string | null
          answered_note?: string | null
          visibility?: PrayerVisibility
          grounding?: Record<string, unknown> | null
          grounding_generated_at?: string | null
        }
        Update: Partial<PrayerRequest>
        Relationships: []
      }
      prayed_marks: {
        Row: PrayedMark
        Insert: Omit<PrayedMark, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<PrayedMark>
        Relationships: []
      }
      tsk_cross_references: {
        Row: TskCrossReference
        Insert: TskCrossReference
        Update: Partial<TskCrossReference>
        Relationships: []
      }
      commentary_entries: {
        Row: CommentaryEntry
        Insert: CommentaryEntry
        Update: Partial<CommentaryEntry>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      verses_for_strongs: {
        Args: { target_id: string; max_results?: number }
        Returns: { verse_id: string; tag_text: string }[]
      }
    }
  }
}
