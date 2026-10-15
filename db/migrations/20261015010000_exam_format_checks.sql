-- migrate:up

-- Who checked an exam format's facts against its official source. Set with
-- last_verified_at by a reviewer in the admin area; saving new facts clears
-- both (packages/content upsertExamFormat).
alter table public.exam_formats
  add column verified_by text references public.profiles (id) on delete set null;

comment on column public.exam_formats.verified_by is
  'The reviewer who last checked these facts against source_url; null until someone has.';

-- migrate:down

alter table public.exam_formats drop column verified_by;
