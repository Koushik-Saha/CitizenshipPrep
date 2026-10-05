-- Structural guarantees that must hold for every table, including ones added
-- later: a new table without RLS fails here.

begin;
select plan(32);

select has_table('public', table_name, format('table %s exists', table_name))
from unnest(array[
  'countries', 'exam_formats', 'topics', 'questions', 'question_translations',
  'profiles', 'user_roles', 'user_countries', 'attempts', 'answer_events', 'mastery',
  'mock_exams', 'subscriptions', 'organizations', 'org_members', 'content_flags',
  'community_posts', 'community_comments', 'source_documents', 'source_passages',
  'question_reviews', 'user_settings', 'ai_explanations', 'ai_usage', 'audio_clips'
]) as table_name;

select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  $$,
  'every table in public has row level security enabled'
);

select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not exists (
        select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
      )
  $$,
  'every table in public has at least one policy'
);

select is_empty(
  $$
    select table_name, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anonymous' and privilege_type <> 'SELECT'
  $$,
  'anonymous has no privilege beyond SELECT on any table'
);

select set_eq(
  $$
    select table_name::text
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anonymous'
  $$,
  array['countries', 'exam_formats', 'topics', 'questions', 'question_translations'],
  'anonymous can select only the public content tables'
);

select is_empty(
  $$
    select table_name
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'authenticated'
      and table_name in ('subscriptions', 'answer_events', 'question_reviews')
      and privilege_type in ('UPDATE', 'DELETE', 'TRUNCATE')
  $$,
  'clients cannot modify subscriptions or rewrite the answer and review logs'
);

select is_empty(
  $$
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) as setting
        where setting like 'search_path=%'
      )
  $$,
  'every SECURITY DEFINER function pins its search_path'
);

select is_empty(
  $$
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  $$,
  'no SECURITY DEFINER function is exposed through the public schema'
);

select * from finish();
rollback;
