-- Proper profile location fields (collected during onboarding after login)
alter table public.profiles
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text default 'IN',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_updated_at timestamptz;

comment on column public.profiles.city is 'User city from onboarding / geolocation';
comment on column public.profiles.state is 'User state / region';
comment on column public.profiles.latitude is 'Optional coords from browser geolocation';
comment on column public.profiles.longitude is 'Optional coords from browser geolocation';
