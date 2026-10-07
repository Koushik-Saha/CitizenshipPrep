-- migrate:up

-- A country's place in a public address: "/canada/citizenship-test". It is
-- stored rather than worked out from the name each time, so renaming a
-- country does not move its pages. A country added without one gets it from
-- its name.
--
-- Four letters at least, lower case: a slug is the first part of a path, where
-- a language prefix ("es", "zh-Hans") would otherwise be, and must never be
-- mistaken for one.

create function private.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(
      value,
      'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿ',
      'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOOooooooUUUUuuuuYyy'
    )),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

alter table public.countries add column slug text;

update public.countries set slug = private.slugify(name);

alter table public.countries
  alter column slug set not null,
  add constraint countries_slug_key unique (slug),
  add constraint countries_slug_is_a_path_segment
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 4 and 80);

comment on column public.countries.slug is
  'The country in a public address, e.g. "united-states". Set from the name when left out; does not follow later renames.';

create function private.countries_set_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is null then
    new.slug := private.slugify(new.name);
  end if;
  return new;
end;
$$;

create trigger countries_set_slug
before insert on public.countries
for each row execute function private.countries_set_slug();

-- migrate:down

drop trigger countries_set_slug on public.countries;
drop function private.countries_set_slug();
alter table public.countries drop column slug;
drop function private.slugify(text);
