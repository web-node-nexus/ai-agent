-- Paste in Supabase SQL Editor (one-shot fix).
-- Lets users chat on first message: trial is eligible before the clock starts.

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
