-- migrate:up

-- A post or a comment is screened when it is written. Nothing screened an
-- edit: a learner could write something harmless, have it shown, and then
-- replace its words through the Data API with text no moderator had seen.
-- The app has no "edit" of its own, so a signed-in client may no longer
-- change the words at all. The server (which screens) and staff still can.
create function private.community_keep_screened_words()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anonymous')
     and not (select private.is_staff())
     and (to_jsonb(new) -> 'body' is distinct from to_jsonb(old) -> 'body'
          or to_jsonb(new) -> 'title' is distinct from to_jsonb(old) -> 'title') then
    raise exception 'The words of a post or a comment cannot be changed once it has been screened.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger community_posts_keep_screened_words
before update on public.community_posts
for each row execute function private.community_keep_screened_words();

create trigger community_comments_keep_screened_words
before update on public.community_comments
for each row execute function private.community_keep_screened_words();

-- migrate:down

drop trigger community_comments_keep_screened_words on public.community_comments;
drop trigger community_posts_keep_screened_words on public.community_posts;
drop function private.community_keep_screened_words();
