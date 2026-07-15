// Hand-written types mirroring the Phase 1 Supabase schema
// (supabase/migrations/0001_phase1_schema.sql). Regenerate with
// `supabase gen types typescript` once the project is linked, and
// this file can be replaced wholesale.

export type EntryType = 'margin_note' | 'journal' | 'reflection' | 'templated_journal'
export type RefKind = 'anchor' | 'inline'

export interface Entry {
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
}

export interface VerseReference {
  id: string
  entry_id: string
  user_id: string
  verse_start: string
  verse_end: string
  position: number | null
  ref_kind: RefKind
}

export interface ReadingSession {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  passage_start: string | null
  passage_end: string | null
  last_position: string | null
}

export interface Translation {
  code: string
  name: string
  is_default: boolean
}

export interface Verse {
  verse_id: string
  translation_code: string
  book: string
  chapter: number
  verse: number
  text: string
}

export interface Database {
  public: {
    Tables: {
      entries: {
        Row: Entry
        Insert: Omit<Entry, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Entry>
      }
      verse_references: {
        Row: VerseReference
        Insert: Omit<VerseReference, 'id'> & { id?: string }
        Update: Partial<VerseReference>
      }
      reading_sessions: {
        Row: ReadingSession
        Insert: Omit<ReadingSession, 'id'> & { id?: string }
        Update: Partial<ReadingSession>
      }
      translations: {
        Row: Translation
        Insert: Translation
        Update: Partial<Translation>
      }
      verses: {
        Row: Verse
        Insert: Verse
        Update: Partial<Verse>
      }
    }
  }
}
