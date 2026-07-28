-- Written artifacts composed against a specific highlight -- distinct
-- from a Reflection (anchored to arbitrary passage spans, no highlight
-- involved) since these are explicitly scoped to one highlight record.
-- Same entries-store reuse pattern as prayer-attached writing (request_id
-- in 0008_prayer_core.sql).

alter table entries add column highlight_id uuid references highlights(id) on delete cascade;

alter table entries drop constraint entries_entry_type_check;
alter table entries add constraint entries_entry_type_check
  check (entry_type in ('margin_note', 'journal', 'reflection', 'templated_journal', 'prayer_update', 'word', 'concern', 'vision', 'highlight_artifact'));
