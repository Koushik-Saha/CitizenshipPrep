-- migrate:up

-- A learner confirms, when they first set up their study, that they are old
-- enough to use the service and that they accept the terms and the privacy
-- policy. When they did, and which version of the terms it was, is kept: the
-- terms say creating an account accepts them, and this is the record that
-- they were shown and agreed to.
alter table public.user_settings
  add column terms_accepted_at timestamptz,
  add column terms_version text check (terms_version ~ '^\d{4}-\d{2}-\d{2}$'),
  add constraint user_settings_terms_recorded_together
    check ((terms_accepted_at is null) = (terms_version is null));

comment on column public.user_settings.terms_accepted_at is
  'When the learner confirmed their age and accepted the terms and privacy policy. Null until they have.';
comment on column public.user_settings.terms_version is
  'The date of the terms they accepted (TERMS_VERSION in packages/core).';

-- migrate:down

alter table public.user_settings
  drop constraint user_settings_terms_recorded_together,
  drop column terms_version,
  drop column terms_accepted_at;
