-- migrate:up

-- Where to put each country on the landing page globe: a point inside the
-- country (not necessarily its geometric centroid), in degrees.
alter table public.countries
  add column latitude numeric(7, 4) check (latitude between -90 and 90),
  add column longitude numeric(7, 4) check (longitude between -180 and 180),
  add constraint countries_coordinates_together check ((latitude is null) = (longitude is null));

-- migrate:down

alter table public.countries
  drop constraint countries_coordinates_together,
  drop column longitude,
  drop column latitude;
