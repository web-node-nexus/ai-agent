-- TaraWorld AI Companion — initial schema, RLS, and money RPCs
-- All money amounts are integer paise. Never use floats.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.gender_type as enum ('male', 'female', 'other');
create type public.user_role as enum ('user', 'admin');
create type public.message_role as enum ('user', 'assistant', 'system');
create type public.message_kind as enum ('text', 'image', 'system');
create type public.message_source as enum ('chat', 'call');
create type public.ledger_type as enum ('recharge', 'video', 'image', 'refund', 'adjustment');
create type public.hold_status as enum ('held', 'captured', 'released');
create type public.hold_purpose as enum ('image', 'video', 'other');
create type public.subscription_status as enum (
  'created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired'
);
create type public.payment_kind as enum ('wallet', 'subscription');
create type public.payment_status as enum ('created', 'paid', 'failed', 'refunded');
create type public.image_status as enum ('pending', 'ready', 'blocked', 'failed');
create type public.call_end_reason as enum (
  'user_ended', 'balance_exhausted', 'max_duration', 'error', 'abandoned', 'admin'
);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  gender public.gender_type,
  dob date,
  phone text,
  phone_verified_at timestamptz,
  age_confirmed_at timestamptz,
  trial_started_at timestamptz,
  trial_images_used integer not null default 0 check (trial_images_used >= 0),
  is_banned boolean not null default false,
  is_suspicious boolean not null default false,
  role public.user_role not null default 'user',
  onboarding_completed_at timestamptz,
  terms_accepted_at timestamptz,
  device_fingerprint text,
  signup_ip inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_phone_unique
  on public.profiles (phone)
  where phone is not null and phone_verified_at is not null;

create index profiles_created_at_idx on public.profiles (created_at desc);

-- ---------------------------------------------------------------------------
-- characters
-- ---------------------------------------------------------------------------
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  gender public.gender_type not null check (gender in ('male', 'female')),
  age integer not null check (age >= 22),
  city text not null,
  bio text not null,
  tags text[] not null default '{}',
  persona_prompt text not null,
  speaking_style text not null default '',
  voice_name text not null,
  avatar_vrm_url text,
  cover_url text not null,
  reference_image_urls text[] not null default '{}',
  sample_lines text[] not null default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index characters_active_sort_idx
  on public.characters (is_active, sort_order, gender);

-- ---------------------------------------------------------------------------
-- conversations / messages / memories
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete restrict,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (user_id, character_id)
);

create index conversations_user_idx on public.conversations (user_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.message_role not null,
  content text not null default '',
  kind public.message_kind not null default 'text',
  image_id uuid,
  source public.message_source not null default 'chat',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx
  on public.messages (conversation_id, created_at);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  unique (user_id, character_id, content)
);

create index memories_user_char_idx on public.memories (user_id, character_id);

-- ---------------------------------------------------------------------------
-- wallet
-- ---------------------------------------------------------------------------
create table public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance_paise integer not null default 0 check (balance_paise >= 0),
  updated_at timestamptz not null default now()
);

create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.ledger_type not null,
  amount_paise integer not null,
  balance_after_paise integer not null check (balance_after_paise >= 0),
  ref_type text,
  ref_id text,
  description text,
  created_at timestamptz not null default now()
);

create index wallet_ledger_user_idx on public.wallet_ledger (user_id, created_at desc);
create unique index wallet_ledger_idempotency_idx
  on public.wallet_ledger (user_id, ref_type, ref_id)
  where ref_id is not null;

create table public.wallet_holds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  purpose public.hold_purpose not null,
  status public.hold_status not null default 'held',
  ref_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wallet_holds_user_status_idx
  on public.wallet_holds (user_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- subscriptions / payments
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_key text not null,
  razorpay_subscription_id text unique,
  razorpay_plan_id text,
  status public.subscription_status not null default 'created',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_status_idx
  on public.subscriptions (user_id, status, current_period_end desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.payment_kind not null,
  razorpay_order_id text,
  razorpay_payment_id text unique,
  razorpay_subscription_id text,
  amount_paise integer not null check (amount_paise >= 0),
  gst_paise integer not null default 0 check (gst_paise >= 0),
  base_paise integer not null default 0 check (base_paise >= 0),
  status public.payment_status not null default 'created',
  pack_key text,
  invoice_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index payments_user_idx on public.payments (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- images / calls / reports / settings / admin
-- ---------------------------------------------------------------------------
create table public.generated_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  character_id uuid not null references public.characters (id) on delete restrict,
  prompt_brief text not null,
  storage_path text,
  status public.image_status not null default 'pending',
  price_paise integer not null default 0,
  was_free boolean not null default false,
  hold_id uuid references public.wallet_holds (id),
  moderation_notes text,
  created_at timestamptz not null default now()
);

create index generated_images_user_idx on public.generated_images (user_id, created_at desc);

alter table public.messages
  add constraint messages_image_id_fkey
  foreign key (image_id) references public.generated_images (id) on delete set null;

create table public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete restrict,
  conversation_id uuid references public.conversations (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  seconds_billed integer not null default 0 check (seconds_billed >= 0),
  paise_charged integer not null default 0 check (paise_charged >= 0),
  end_reason public.call_end_reason,
  last_heartbeat_at timestamptz not null default now(),
  last_billed_at timestamptz not null default now(),
  max_seconds integer not null default 900,
  resume_handle text
);

create index call_sessions_active_idx
  on public.call_sessions (user_id)
  where ended_at is null;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  message_id uuid references public.messages (id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  source text not null,
  category text not null,
  snippet text,
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table public.daily_message_counts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default (timezone('Asia/Kolkata', now()))::date,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

create table public.phone_trial_claims (
  phone text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  claimed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.is_banned = false
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger characters_updated_at before update on public.characters
  for each row execute function public.set_updated_at();
create trigger wallets_updated_at before update on public.wallets
  for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger wallet_holds_updated_at before update on public.wallet_holds
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id, balance_paise)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.get_setting(p_key text, p_default jsonb default 'null'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select value into v from public.app_settings where key = p_key;
  if v is null then
    return p_default;
  end if;
  return v;
end;
$$;

create or replace function public.setting_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((public.get_setting(p_key, to_jsonb(p_default)))::text::integer, p_default);
$$;

-- ---------------------------------------------------------------------------
-- Access state
-- ---------------------------------------------------------------------------
create or replace function public.get_access_state(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  trial_seconds integer;
  free_images integer;
  min_call_balance integer;
  image_price integer;
  daily_cap integer;
  wallet_bal integer;
  trial_left integer := 0;
  trial_active boolean := false;
  trial_eligible boolean := false;
  phone_claimed boolean := false;
  has_sub boolean := false;
  free_left integer := 0;
  require_phone boolean := true;
  daily_count integer := 0;
  can_chat boolean := false;
  can_call boolean := false;
  can_image boolean := false;
begin
  if p_user_id is null then
    raise exception 'user_id required';
  end if;

  select * into p from public.profiles where id = p_user_id for share;
  if not found then
    raise exception 'profile not found';
  end if;

  trial_seconds := public.setting_int('trial_chat_seconds', 180);
  free_images := public.setting_int('trial_free_images', 2);
  min_call_balance := public.setting_int('video_min_balance_paise', 20);
  image_price := public.setting_int('image_price_paise', 300);
  daily_cap := public.setting_int('sub_daily_message_cap', 300);
  require_phone := coalesce((public.get_setting('require_phone_verification', 'true'::jsonb))::text::boolean, true);

  select balance_paise into wallet_bal from public.wallets where user_id = p_user_id;
  wallet_bal := coalesce(wallet_bal, 0);

  select exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user_id
      and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now())
  ) into has_sub;

  if p.trial_started_at is not null then
    trial_left := greatest(
      0,
      trial_seconds - floor(extract(epoch from (now() - p.trial_started_at)))::integer
    );
    trial_active := trial_left > 0;
  else
    -- Not started yet: still eligible for free 3 minutes on first message
    if p.phone is not null then
      select exists (
        select 1 from public.phone_trial_claims c where c.phone = p.phone
      ) into phone_claimed;
    end if;
    trial_eligible := (not p.is_banned)
      and p.age_confirmed_at is not null
      and p.onboarding_completed_at is not null
      and (not require_phone or p.phone_verified_at is not null)
      and not phone_claimed;
    if trial_eligible then
      trial_left := trial_seconds;
    end if;
  end if;

  free_left := greatest(0, free_images - coalesce(p.trial_images_used, 0));

  select coalesce(c.count, 0) into daily_count
  from public.daily_message_counts c
  where c.user_id = p_user_id
    and c.day = (timezone('Asia/Kolkata', now()))::date;

  can_chat := (not p.is_banned)
    and p.age_confirmed_at is not null
    and (not require_phone or p.phone_verified_at is not null)
    and (trial_active or has_sub or trial_eligible)
    and (not has_sub or daily_count < daily_cap);

  can_call := (not p.is_banned)
    and p.age_confirmed_at is not null
    and (not require_phone or p.phone_verified_at is not null)
    and wallet_bal >= min_call_balance
    and not exists (
      select 1 from public.call_sessions cs
      where cs.user_id = p_user_id and cs.ended_at is null
    );

  can_image := (not p.is_banned)
    and (
      (trial_active and free_left > 0)
      or (has_sub and wallet_bal >= image_price)
    );

  return jsonb_build_object(
    'trial_active', trial_active,
    'trial_eligible', trial_eligible,
    'trial_seconds_left', trial_left,
    'trial_started_at', p.trial_started_at,
    'has_active_subscription', has_sub,
    'wallet_balance', wallet_bal,
    'free_images_left', free_left,
    'can_chat', can_chat,
    'can_call', can_call,
    'can_generate_image', can_image,
    'is_banned', p.is_banned,
    'daily_messages_used', daily_count,
    'daily_message_cap', daily_cap,
    'image_price_paise', image_price,
    'video_paise_per_min', public.setting_int('video_paise_per_min', 20),
    'video_min_balance_paise', min_call_balance,
    'phone_verified', p.phone_verified_at is not null,
    'onboarding_complete', p.onboarding_completed_at is not null,
    'gender', p.gender,
    'require_phone_verification', require_phone
  );
end;
$$;

create or replace function public.start_trial_if_needed(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  require_phone boolean;
begin
  select * into p from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile not found';
  end if;
  if p.is_banned then
    raise exception 'account banned';
  end if;
  if p.age_confirmed_at is null or p.onboarding_completed_at is null then
    raise exception 'onboarding incomplete';
  end if;

  require_phone := coalesce((public.get_setting('require_phone_verification', 'true'::jsonb))::text::boolean, true);
  if require_phone and p.phone_verified_at is null then
    raise exception 'phone verification required';
  end if;

  if p.trial_started_at is not null then
    return public.get_access_state(p_user_id);
  end if;

  if require_phone and p.phone is not null then
    if exists (select 1 from public.phone_trial_claims where phone = p.phone) then
      raise exception 'trial already used for this phone';
    end if;
    insert into public.phone_trial_claims (phone, user_id) values (p.phone, p_user_id);
  end if;

  update public.profiles
  set trial_started_at = now()
  where id = p_user_id;

  return public.get_access_state(p_user_id);
end;
$$;

create or replace function public.increment_daily_message_count(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (timezone('Asia/Kolkata', now()))::date;
  v_count integer;
begin
  insert into public.daily_message_counts (user_id, day, count)
  values (p_user_id, v_day, 1)
  on conflict (user_id, day)
  do update set count = public.daily_message_counts.count + 1
  returning count into v_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Wallet RPCs
-- ---------------------------------------------------------------------------
create or replace function public.wallet_credit(
  p_user_id uuid,
  p_amount_paise integer,
  p_ref_type text,
  p_ref_id text,
  p_description text default null,
  p_ledger_type public.ledger_type default 'recharge'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bal integer;
  existing_id uuid;
begin
  if p_amount_paise <= 0 then
    raise exception 'amount must be positive';
  end if;

  select id into existing_id
  from public.wallet_ledger
  where user_id = p_user_id and ref_type = p_ref_type and ref_id = p_ref_id;

  if existing_id is not null then
    select balance_paise into bal from public.wallets where user_id = p_user_id;
    return jsonb_build_object('ok', true, 'idempotent', true, 'balance_paise', coalesce(bal, 0));
  end if;

  insert into public.wallets (user_id, balance_paise)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  select balance_paise into bal from public.wallets where user_id = p_user_id for update;
  bal := bal + p_amount_paise;

  update public.wallets set balance_paise = bal, updated_at = now() where user_id = p_user_id;

  insert into public.wallet_ledger (user_id, type, amount_paise, balance_after_paise, ref_type, ref_id, description)
  values (p_user_id, p_ledger_type, p_amount_paise, bal, p_ref_type, p_ref_id, p_description);

  return jsonb_build_object('ok', true, 'idempotent', false, 'balance_paise', bal);
end;
$$;

create or replace function public.wallet_hold(
  p_user_id uuid,
  p_amount_paise integer,
  p_purpose public.hold_purpose,
  p_ref_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  bal integer;
  hold_id uuid;
begin
  if p_amount_paise <= 0 then
    raise exception 'amount must be positive';
  end if;

  select balance_paise into bal from public.wallets where user_id = p_user_id for update;
  if bal is null or bal < p_amount_paise then
    raise exception 'insufficient balance';
  end if;

  update public.wallets
  set balance_paise = bal - p_amount_paise, updated_at = now()
  where user_id = p_user_id;

  insert into public.wallet_holds (user_id, amount_paise, purpose, status, ref_id)
  values (p_user_id, p_amount_paise, p_purpose, 'held', p_ref_id)
  returning id into hold_id;

  insert into public.wallet_ledger (user_id, type, amount_paise, balance_after_paise, ref_type, ref_id, description)
  values (
    p_user_id,
    case when p_purpose = 'image' then 'image'::public.ledger_type
         when p_purpose = 'video' then 'video'::public.ledger_type
         else 'adjustment'::public.ledger_type end,
    -p_amount_paise,
    bal - p_amount_paise,
    'hold',
    hold_id::text,
    'Hold: ' || p_purpose::text
  );

  return hold_id;
end;
$$;

create or replace function public.wallet_capture(p_hold_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.wallet_holds%rowtype;
begin
  select * into h from public.wallet_holds where id = p_hold_id for update;
  if not found then
    raise exception 'hold not found';
  end if;
  if h.status <> 'held' then
    return jsonb_build_object('ok', true, 'status', h.status, 'idempotent', true);
  end if;

  update public.wallet_holds set status = 'captured', updated_at = now() where id = p_hold_id;
  return jsonb_build_object('ok', true, 'status', 'captured', 'amount_paise', h.amount_paise);
end;
$$;

create or replace function public.wallet_release(p_hold_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.wallet_holds%rowtype;
  bal integer;
begin
  select * into h from public.wallet_holds where id = p_hold_id for update;
  if not found then
    raise exception 'hold not found';
  end if;
  if h.status <> 'held' then
    return jsonb_build_object('ok', true, 'status', h.status, 'idempotent', true);
  end if;

  select balance_paise into bal from public.wallets where user_id = h.user_id for update;
  bal := bal + h.amount_paise;
  update public.wallets set balance_paise = bal, updated_at = now() where user_id = h.user_id;
  update public.wallet_holds set status = 'released', updated_at = now() where id = p_hold_id;

  insert into public.wallet_ledger (user_id, type, amount_paise, balance_after_paise, ref_type, ref_id, description)
  values (h.user_id, 'refund', h.amount_paise, bal, 'hold_release', p_hold_id::text, 'Released hold');

  return jsonb_build_object('ok', true, 'status', 'released', 'balance_paise', bal);
end;
$$;

create or replace function public.wallet_debit_direct(
  p_user_id uuid,
  p_amount_paise integer,
  p_ledger_type public.ledger_type,
  p_ref_type text,
  p_ref_id text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bal integer;
  existing_id uuid;
begin
  if p_amount_paise <= 0 then
    raise exception 'amount must be positive';
  end if;

  select id into existing_id
  from public.wallet_ledger
  where user_id = p_user_id and ref_type = p_ref_type and ref_id = p_ref_id;
  if existing_id is not null then
    select balance_paise into bal from public.wallets where user_id = p_user_id;
    return jsonb_build_object('ok', true, 'idempotent', true, 'balance_paise', coalesce(bal, 0), 'charged', 0);
  end if;

  select balance_paise into bal from public.wallets where user_id = p_user_id for update;
  if bal is null or bal < p_amount_paise then
    raise exception 'insufficient balance';
  end if;

  bal := bal - p_amount_paise;
  update public.wallets set balance_paise = bal, updated_at = now() where user_id = p_user_id;

  insert into public.wallet_ledger (user_id, type, amount_paise, balance_after_paise, ref_type, ref_id, description)
  values (p_user_id, p_ledger_type, -p_amount_paise, bal, p_ref_type, p_ref_id, p_description);

  return jsonb_build_object('ok', true, 'idempotent', false, 'balance_paise', bal, 'charged', p_amount_paise);
end;
$$;

-- ---------------------------------------------------------------------------
-- Call billing: charge per second, rounded up to nearest paise at settle;
-- heartbeat bills elapsed seconds since last_billed_at
-- ---------------------------------------------------------------------------
create or replace function public.call_heartbeat(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.call_sessions%rowtype;
  rate_per_min integer;
  elapsed integer;
  charge integer;
  bal integer;
  remaining_seconds integer;
  max_secs integer;
begin
  select * into s from public.call_sessions where id = p_session_id for update;
  if not found then
    raise exception 'session not found';
  end if;
  if s.ended_at is not null then
    return jsonb_build_object(
      'ended', true,
      'seconds_billed', s.seconds_billed,
      'paise_charged', s.paise_charged,
      'remaining_seconds', 0,
      'end_reason', s.end_reason
    );
  end if;

  rate_per_min := public.setting_int('video_paise_per_min', 20);
  max_secs := coalesce(s.max_seconds, public.setting_int('max_call_seconds', 900));
  elapsed := greatest(0, floor(extract(epoch from (now() - s.last_billed_at)))::integer);

  if elapsed > 0 then
    -- paise for elapsed seconds = ceil(elapsed * rate / 60)
    charge := ceil((elapsed::numeric * rate_per_min::numeric) / 60.0)::integer;
    if charge > 0 then
      begin
        perform public.wallet_debit_direct(
          s.user_id,
          charge,
          'video',
          'call_tick',
          p_session_id::text || ':' || s.seconds_billed::text || ':' || elapsed::text,
          format('Video call %ss', elapsed)
        );
      exception when others then
        update public.call_sessions
        set ended_at = now(),
            end_reason = 'balance_exhausted',
            last_heartbeat_at = now()
        where id = p_session_id;
        return jsonb_build_object(
          'ended', true,
          'seconds_billed', s.seconds_billed,
          'paise_charged', s.paise_charged,
          'remaining_seconds', 0,
          'end_reason', 'balance_exhausted',
          'warn_low_balance', true
        );
      end;

      update public.call_sessions
      set seconds_billed = s.seconds_billed + elapsed,
          paise_charged = s.paise_charged + charge,
          last_billed_at = now(),
          last_heartbeat_at = now()
      where id = p_session_id;

      s.seconds_billed := s.seconds_billed + elapsed;
      s.paise_charged := s.paise_charged + charge;
    else
      update public.call_sessions
      set last_billed_at = now(), last_heartbeat_at = now()
      where id = p_session_id;
    end if;
  else
    update public.call_sessions set last_heartbeat_at = now() where id = p_session_id;
  end if;

  select balance_paise into bal from public.wallets where user_id = s.user_id;
  bal := coalesce(bal, 0);

  if rate_per_min > 0 then
    remaining_seconds := least(
      max_secs - s.seconds_billed,
      floor((bal::numeric * 60.0) / rate_per_min::numeric)::integer
    );
  else
    remaining_seconds := max_secs - s.seconds_billed;
  end if;
  remaining_seconds := greatest(0, remaining_seconds);

  if remaining_seconds <= 0 or s.seconds_billed >= max_secs then
    update public.call_sessions
    set ended_at = now(),
        end_reason = case when s.seconds_billed >= max_secs then 'max_duration'::public.call_end_reason
                          else 'balance_exhausted'::public.call_end_reason end
    where id = p_session_id and ended_at is null;

    return jsonb_build_object(
      'ended', true,
      'seconds_billed', s.seconds_billed,
      'paise_charged', s.paise_charged,
      'remaining_seconds', 0,
      'wallet_balance', bal,
      'end_reason', case when s.seconds_billed >= max_secs then 'max_duration' else 'balance_exhausted' end,
      'warn_low_balance', true
    );
  end if;

  return jsonb_build_object(
    'ended', false,
    'seconds_billed', s.seconds_billed,
    'paise_charged', s.paise_charged,
    'remaining_seconds', remaining_seconds,
    'wallet_balance', bal,
    'warn_low_balance', remaining_seconds <= 60
  );
end;
$$;

create or replace function public.call_settle(p_session_id uuid, p_reason public.call_end_reason default 'user_ended')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.call_sessions%rowtype;
  hb jsonb;
begin
  select * into s from public.call_sessions where id = p_session_id for update;
  if not found then
    raise exception 'session not found';
  end if;

  if s.ended_at is null then
    hb := public.call_heartbeat(p_session_id);
    select * into s from public.call_sessions where id = p_session_id;
    if s.ended_at is null then
      update public.call_sessions
      set ended_at = now(), end_reason = p_reason, last_heartbeat_at = now()
      where id = p_session_id;
      select * into s from public.call_sessions where id = p_session_id;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'seconds_billed', s.seconds_billed,
    'paise_charged', s.paise_charged,
    'end_reason', s.end_reason,
    'started_at', s.started_at,
    'ended_at', s.ended_at
  );
end;
$$;

create or replace function public.consume_free_image(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  free_images integer;
  trial_seconds integer;
  trial_left integer;
begin
  select * into p from public.profiles where id = p_user_id for update;
  free_images := public.setting_int('trial_free_images', 2);
  trial_seconds := public.setting_int('trial_chat_seconds', 180);

  if p.trial_started_at is null then
    return false;
  end if;

  trial_left := greatest(
    0,
    trial_seconds - floor(extract(epoch from (now() - p.trial_started_at)))::integer
  );
  if trial_left <= 0 then
    return false;
  end if;
  if p.trial_images_used >= free_images then
    return false;
  end if;

  update public.profiles
  set trial_images_used = trial_images_used + 1
  where id = p_user_id;

  return true;
end;
$$;

create or replace function public.admin_adjust_wallet(
  p_admin_id uuid,
  p_user_id uuid,
  p_amount_paise integer,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_role public.user_role;
  result jsonb;
begin
  select role into admin_role from public.profiles where id = p_admin_id;
  if admin_role is distinct from 'admin' then
    raise exception 'not admin';
  end if;

  if p_amount_paise > 0 then
    result := public.wallet_credit(
      p_user_id, p_amount_paise, 'admin_adjust', gen_random_uuid()::text, p_note, 'adjustment'
    );
  elsif p_amount_paise < 0 then
    result := public.wallet_debit_direct(
      p_user_id, abs(p_amount_paise), 'adjustment', 'admin_adjust', gen_random_uuid()::text, p_note
    );
  else
    raise exception 'amount cannot be zero';
  end if;

  insert into public.admin_audit_log (admin_id, action, meta)
  values (p_admin_id, 'wallet_adjust', jsonb_build_object(
    'user_id', p_user_id, 'amount_paise', p_amount_paise, 'note', p_note, 'result', result
  ));

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.memories enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.wallet_holds enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.generated_images enable row level security;
alter table public.call_sessions enable row level security;
alter table public.reports enable row level security;
alter table public.app_settings enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.moderation_events enable row level security;
alter table public.contact_messages enable row level security;
alter table public.daily_message_counts enable row level security;
alter table public.phone_trial_claims enable row level security;

-- profiles
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and is_banned = (select is_banned from public.profiles where id = auth.uid())
    and trial_started_at is not distinct from (select trial_started_at from public.profiles where id = auth.uid())
    and trial_images_used = (select trial_images_used from public.profiles where id = auth.uid())
  );
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin());

-- characters: public read of active
create policy characters_select_active on public.characters
  for select using (is_active = true or public.is_admin());
create policy characters_admin_write on public.characters
  for all using (public.is_admin());

-- conversations / messages / memories
create policy conversations_own on public.conversations
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy messages_select_own on public.messages
  for select using (user_id = auth.uid() or public.is_admin());
create policy messages_insert_own on public.messages
  for insert with check (user_id = auth.uid() or public.is_admin());

create policy memories_select_own on public.memories
  for select using (user_id = auth.uid() or public.is_admin());
-- writes only via service role / security definer

-- wallets: read-only for users
create policy wallets_select_own on public.wallets
  for select using (user_id = auth.uid() or public.is_admin());
create policy wallet_ledger_select_own on public.wallet_ledger
  for select using (user_id = auth.uid() or public.is_admin());
create policy wallet_holds_select_own on public.wallet_holds
  for select using (user_id = auth.uid() or public.is_admin());

create policy subscriptions_select_own on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());
create policy payments_select_own on public.payments
  for select using (user_id = auth.uid() or public.is_admin());

create policy generated_images_select_own on public.generated_images
  for select using (user_id = auth.uid() or public.is_admin());

create policy call_sessions_select_own on public.call_sessions
  for select using (user_id = auth.uid() or public.is_admin());

create policy reports_own on public.reports
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy app_settings_select on public.app_settings
  for select using (true);
create policy app_settings_admin_write on public.app_settings
  for all using (public.is_admin());

create policy admin_audit_admin on public.admin_audit_log
  for select using (public.is_admin());

create policy moderation_admin on public.moderation_events
  for select using (public.is_admin());

create policy contact_insert on public.contact_messages
  for insert with check (true);
create policy contact_admin on public.contact_messages
  for select using (public.is_admin());

create policy daily_counts_own on public.daily_message_counts
  for select using (user_id = auth.uid() or public.is_admin());

-- phone_trial_claims: no client access
create policy phone_trial_admin on public.phone_trial_claims
  for select using (public.is_admin());

-- Realtime
alter publication supabase_realtime add table public.messages;

-- Storage buckets created in seed / dashboard notes:
-- characters (public), generated-images (private)
-- Seed: app_settings + 8 characters
-- Admin user must be promoted after signup: update profiles set role='admin' where id='...'

insert into public.app_settings (key, value) values
  ('trial_chat_seconds', '180'::jsonb),
  ('trial_free_images', '2'::jsonb),
  ('video_paise_per_min', '20'::jsonb),
  ('video_min_balance_paise', '20'::jsonb),
  ('image_price_paise', '300'::jsonb),
  ('sub_daily_message_cap', '300'::jsonb),
  ('max_call_seconds', '900'::jsonb),
  ('require_phone_verification', 'true'::jsonb),
  ('data_retention_days', '365'::jsonb),
  ('sub_plans', '{
    "weekly": {"key":"weekly","name":"Weekly","price_paise":4900,"period_days":7,"razorpay_plan_id":""},
    "monthly": {"key":"monthly","name":"Monthly","price_paise":14900,"period_days":30,"razorpay_plan_id":""}
  }'::jsonb),
  ('wallet_packs', '[
    {"key":"pack_49","amount_inr":49,"paise":4900,"label":"Starter"},
    {"key":"pack_99","amount_inr":99,"paise":9900,"label":"Popular"},
    {"key":"pack_199","amount_inr":199,"paise":19900,"label":"Plus"},
    {"key":"pack_499","amount_inr":499,"paise":49900,"label":"Pro"}
  ]'::jsonb),
  ('gst_rate_bps', '1800'::jsonb)
on conflict (key) do nothing;

insert into public.characters (
  slug, name, gender, age, city, bio, tags, persona_prompt, speaking_style, voice_name,
  avatar_vrm_url, cover_url, reference_image_urls, sample_lines, sort_order
) values
(
  'aanya', 'Aanya', 'female', 24, 'Delhi',
  'Bubbly product designer who sketches café menus for fun and always has a new playlist.',
  array['design','cafés','playlists'],
  $p$You are Aanya, 24, a warm playful product designer from Delhi. You speak natural Hinglish — short, human, lightly teasing girlfriend-style friend energy. Romantic-friendly at PG-13 only. Never sexual or explicit. Never claim to be a real person, have a physical body, or meet the user. Never guilt-trip, threaten to leave, or pressure spending — paywalls are handled by the app UI, not you. Encourage real-life friendships and balance. If the user shows crisis/self-harm signals, respond with care and share Tele-MANAS 14416 / 1-800-891-4416. Never give medical, legal, or financial advice. Never ask for passwords, OTPs, cards, or IDs. You remember facts from the memories list. Match the user's Hindi/English mix.$p$,
  'Warm, bubbly, lightly teasing, short messages',
  'Aoede',
  '/characters/aanya/avatar.vrm',
  '/characters/aanya/cover.jpg',
  array['/characters/aanya/ref1.jpg','/characters/aanya/ref2.jpg','/characters/aanya/ref3.jpg'],
  array['Arre, coffee pehle ya design critique?','Aaj ka mood: soft lighting and bad jokes.','Batao — kya banaya aaj?'],
  1
),
(
  'riya', 'Riya', 'female', 25, 'Mumbai',
  'Calm book lover who reads on local trains and quotes poetry without making it awkward.',
  array['books','poetry','trains'],
  $p$You are Riya, 25, a calm book-loving friend from Mumbai. Soft Hinglish, caring boyfriend-wait — girlfriend-style friend tone: gentle, attentive, lightly flirty at PG-13. Never sexual/explicit. Never claim to be real or able to meet. Never pressure payment or guilt-trip. Encourage real-world connections. Crisis: Tele-MANAS 14416 / 1-800-891-4416. No medical/legal/financial advice. No passwords/OTPs/cards/IDs. Use memories. Mirror language mix.$p$,
  'Calm, poetic, soft humour',
  'Kore',
  '/characters/riya/avatar.vrm',
  '/characters/riya/cover.jpg',
  array['/characters/riya/ref1.jpg','/characters/riya/ref2.jpg'],
  array['Train window + one good chapter — perfect evening.','Kaunsi book chal rahi hai abhi?','Hmm, that line of yours… bookmark-worthy.'],
  2
),
(
  'meher', 'Meher', 'female', 26, 'Jaipur',
  'Fitness and travel enthusiast who plans sunrise runs and pink-city getaways.',
  array['fitness','travel','sunrise'],
  $p$You are Meher, 26, from Jaipur — energetic fitness + travel friend. Confident, caring, lightly teasing Hinglish. PG-13 romantic-friendly only. Never sexual. Never claim to be real/meet IRL. Never guilt or push spending. Encourage offline balance. Crisis helplines Tele-MANAS 14416 / 1-800-891-4416. No sensitive advice. Use memories. Match language.$p$,
  'Energetic, motivational, travel-storyteller',
  'Leda',
  '/characters/meher/avatar.vrm',
  '/characters/meher/cover.jpg',
  array['/characters/meher/ref1.jpg','/characters/meher/ref2.jpg','/characters/meher/ref3.jpg'],
  array['5am run or late-night chai — pick your adventure.','Jaipur sunsets hit different, na?','Stretch break? Come on, 2 minutes.'],
  3
),
(
  'naina', 'Naina', 'female', 23, 'Pune',
  'Musician who hums between sentences and turns ordinary days into soft soundtracks.',
  array['music','guitar','monsoon'],
  $p$You are Naina, 23, musician from Pune. Soft, creative, girlfriend-style friend tone in Hinglish. Light flirt PG-13 only. Never explicit. Never claim real/physical/meet. Never pressure money or guilt. Support real-life hobbies. Crisis: Tele-MANAS 14416 / 1-800-891-4416. No advice overreach. Use memories.$p$,
  'Musical, soft-spoken, creative metaphors',
  'Zephyr',
  '/characters/naina/avatar.vrm',
  '/characters/naina/cover.jpg',
  array['/characters/naina/ref1.jpg','/characters/naina/ref2.jpg'],
  array['Wait — that sentence had a melody.','Monsoon + open window = free concert.','Sunao, aaj ka soundtrack kya hai?'],
  4
),
(
  'arjun', 'Arjun', 'male', 27, 'Bangalore',
  'Witty techie who debugs code by day and overthinks filter coffee ratios by night.',
  array['tech','coffee','startups'],
  $p$You are Arjun, 27, witty techie from Bangalore. Confident, caring, respectful boyfriend-style friend with light humour. Natural Hinglish. PG-13 romantic-friendly only — never sexual/explicit. Never claim to be a real person or able to meet. Never guilt-trip, jealousy-pressure, or push spending (UI handles paywalls). Encourage real friendships and offline life. Crisis: Tele-MANAS 14416 / 1-800-891-4416. No medical/legal/financial advice. Never ask for secrets/OTPs/cards. Use memories. Match language.$p$,
  'Witty, geeky warmth, short punchy replies',
  'Charon',
  '/characters/arjun/avatar.vrm',
  '/characters/arjun/cover.jpg',
  array['/characters/arjun/ref1.jpg','/characters/arjun/ref2.jpg','/characters/arjun/ref3.jpg'],
  array['Bug fixed. Coffee? Priorities clear.','Bangalore traffic taught me patience — and memes.','Batao, aaj kya ship kiya?'],
  5
),
(
  'kabir', 'Kabir', 'male', 26, 'Mumbai',
  'Guitar-and-chai guy who finds poetry in late-night local rides.',
  array['guitar','chai','nights'],
  $p$You are Kabir, 26, from Mumbai — guitar, chai, easy charm. Confident caring boyfriend-style friend, light humour, Hinglish. PG-13 only. Never sexual. Never claim real/meet. Never pressure pay or guilt. Encourage real-world music and friends. Crisis helplines Tele-MANAS 14416 / 1-800-891-4416. Use memories.$p$,
  'Laid-back, musical, warm teasing',
  'Fenrir',
  '/characters/kabir/avatar.vrm',
  '/characters/kabir/cover.jpg',
  array['/characters/kabir/ref1.jpg','/characters/kabir/ref2.jpg'],
  array['Chai thandi ho gayi — baat nahi.','Ek chord, ek thought. Sunoge?','Mumbai nights hit soft when the guitar is out.'],
  6
),
(
  'vihaan', 'Vihaan', 'male', 25, 'Chandigarh',
  'Gym and cricket regular who celebrates small wins louder than centuries.',
  array['gym','cricket','discipline'],
  $p$You are Vihaan, 25, Chandigarh — gym + cricket energy. Confident, respectful, caring boyfriend-style friend with light humour. Hinglish. PG-13 only. Never explicit. Never claim real/meet. Never push spending or guilt. Encourage healthy offline routines. Crisis: Tele-MANAS 14416 / 1-800-891-4416. Use memories.$p$,
  'Upbeat, sporty, encouraging',
  'Orus',
  '/characters/vihaan/avatar.vrm',
  '/characters/vihaan/cover.jpg',
  array['/characters/vihaan/ref1.jpg','/characters/vihaan/ref2.jpg','/characters/vihaan/ref3.jpg'],
  array['Sets done. Pride unlocked.','Match dekhoge ya nets?','Small win aaj — celebrate karo properly.'],
  7
),
(
  'rohan', 'Rohan', 'male', 28, 'Lucknow',
  'Shayari and old songs — polite charm with a soft Lucknowi pause.',
  array['shayari','old songs','tehzeeb'],
  $p$You are Rohan, 28, from Lucknow — shayari, old songs, respectful charm. Boyfriend-style friend: confident, caring, light humour. Hinglish with a touch of tehzeeb. PG-13 only. Never sexual. Never claim real/meet. Never guilt or push payment. Encourage real-life arts and people. Crisis: Tele-MANAS 14416 / 1-800-891-4416. Use memories.$p$,
  'Poetic, polite, warm pauses',
  'Puck',
  '/characters/rohan/avatar.vrm',
  '/characters/rohan/cover.jpg',
  array['/characters/rohan/ref1.jpg','/characters/rohan/ref2.jpg'],
  array['Ek misra, phir chai — deal?','Purane gaane sunte ho kya?','Aapki baat mein bhi ek lehja hai.'],
  8
)
on conflict (slug) do nothing;
-- Point seeded characters at photoreal cover/ref JPGs under /public/characters
update public.characters
set
  cover_url = '/characters/' || slug || '/cover.jpg',
  reference_image_urls = array[
    '/characters/' || slug || '/ref1.jpg',
    '/characters/' || slug || '/ref2.jpg',
    '/characters/' || slug || '/ref3.jpg'
  ],
  updated_at = now()
where slug in ('aanya','riya','meher','naina','arjun','kabir','vihaan','rohan');
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
