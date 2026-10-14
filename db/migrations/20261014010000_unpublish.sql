-- migrate:up

-- A published question can be taken back to the review queue ("unpublished"),
-- and that decision is kept in its history like the others.
alter table public.question_reviews drop constraint question_reviews_action_check;
alter table public.question_reviews add constraint question_reviews_action_check check (
  action in ('approved', 'edited', 'rejected', 'reverified', 'unpublished',
             'translation_approved', 'translation_rejected')
);

-- migrate:down

delete from public.question_reviews where action = 'unpublished';
alter table public.question_reviews drop constraint question_reviews_action_check;
alter table public.question_reviews add constraint question_reviews_action_check check (
  action in ('approved', 'edited', 'rejected', 'reverified', 'translation_approved',
             'translation_rejected')
);
