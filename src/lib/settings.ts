import { createServiceClient } from "@/lib/supabase/server";
import type { AppSettingsMap, SubPlan, WalletPack } from "@/types/database";

const DEFAULTS: AppSettingsMap = {
  trial_chat_seconds: 180,
  trial_free_images: 2,
  video_paise_per_min: 20,
  video_min_balance_paise: 20,
  image_price_paise: 300,
  sub_daily_message_cap: 300,
  max_call_seconds: 900,
  require_phone_verification: true,
  data_retention_days: 365,
  gst_rate_bps: 1800,
  sub_plans: {
    weekly: {
      key: "weekly",
      name: "Weekly",
      price_paise: 4900,
      period_days: 7,
      razorpay_plan_id: "",
    },
    monthly: {
      key: "monthly",
      name: "Monthly",
      price_paise: 14900,
      period_days: 30,
      razorpay_plan_id: "",
    },
  },
  wallet_packs: [
    { key: "pack_49", amount_inr: 49, paise: 4900, label: "Starter" },
    { key: "pack_99", amount_inr: 99, paise: 9900, label: "Popular" },
    { key: "pack_199", amount_inr: 199, paise: 19900, label: "Plus" },
    { key: "pack_499", amount_inr: 499, paise: 49900, label: "Pro" },
  ],
};

export async function getAppSettings(): Promise<AppSettingsMap> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("app_settings").select("key, value");
  if (!data?.length) return DEFAULTS;

  const map = { ...DEFAULTS } as AppSettingsMap;
  for (const row of data) {
    const key = row.key as keyof AppSettingsMap;
    if (!(key in DEFAULTS)) continue;
    const value = row.value;
    if (key === "sub_plans") {
      map.sub_plans = value as Record<string, SubPlan>;
    } else if (key === "wallet_packs") {
      map.wallet_packs = value as WalletPack[];
    } else if (key === "require_phone_verification") {
      map.require_phone_verification = Boolean(value);
    } else {
      (map as unknown as Record<string, unknown>)[key] = Number(value);
    }
  }
  return map;
}

export async function getAccessState(userId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("get_access_state", {
    p_user_id: userId,
  });
  if (error) throw error;
  return data;
}

export async function updateSubPlans(
  plans: Record<string, SubPlan>
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: "sub_plans",
      value: plans,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) throw error;
}

/**
 * Ensure each chat plan has a Razorpay plan_id (creates on Razorpay if missing).
 * Needed so checkout can start UPI Autopay / card mandate.
 */
export async function ensureRazorpayPlanIds(
  createPlan: (plan: SubPlan) => Promise<{ id: string }>
): Promise<Record<string, SubPlan>> {
  const settings = await getAppSettings();
  const plans = { ...settings.sub_plans };
  let changed = false;

  for (const key of Object.keys(plans)) {
    const plan = plans[key];
    if (!plan || plan.razorpay_plan_id) continue;
    const created = await createPlan(plan);
    plans[key] = { ...plan, razorpay_plan_id: created.id };
    changed = true;
  }

  if (changed) {
    await updateSubPlans(plans);
  }
  return plans;
}
