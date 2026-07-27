-- New prayer-history classification alongside update/word/concern: a
-- place for the vision God has given for a request -- the hoped-for
-- outcome, not just progress notes or a sensed word. Same entries-store
-- reuse pattern as the other prayer entry_types (0008_prayer_core.sql).

alter table entries drop constraint entries_entry_type_check;
alter table entries add constraint entries_entry_type_check
  check (entry_type in ('margin_note', 'journal', 'reflection', 'templated_journal', 'prayer_update', 'word', 'concern', 'vision'));
