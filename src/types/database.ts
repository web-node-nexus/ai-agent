export type Gender = "male" | "female" | "other";
export type UserRole = "user" | "admin";
export type MessageRole = "user" | "assistant" | "system";
export type MessageKind = "text" | "image" | "system";
export type MessageSource = "chat" | "call";
export type LedgerType = "recharge" | "video" | "image" | "refund" | "adjustment";
export type HoldStatus = "held" | "captured" | "released";
export type HoldPurpose = "image" | "video" | "other";
export type SubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired";
export type PaymentKind = "wallet" | "subscription";
export type PaymentStatus = "created" | "paid" | "failed" | "refunded";
export type ImageStatus = "pending" | "ready" | "blocked" | "failed";
export type CallEndReason =
  | "user_ended"
  | "balance_exhausted"
  | "max_duration"
  | "error"
  | "abandoned"
  | "admin";

export interface Profile {
  id: string;
  name: string | null;
  gender: Gender | null;
  dob: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  age_confirmed_at: string | null;
  trial_started_at: string | null;
  trial_images_used: number;
  is_banned: boolean;
  is_suspicious: boolean;
  role: UserRole;
  onboarding_completed_at: string | null;
  terms_accepted_at: string | null;
  device_fingerprint: string | null;
  signup_ip: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  location_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Character {
  id: string;
  slug: string;
  name: string;
  gender: "male" | "female";
  age: number;
  city: string;
  bio: string;
  tags: string[];
  persona_prompt: string;
  speaking_style: string;
  voice_name: string;
  avatar_vrm_url: string | null;
  cover_url: string;
  reference_image_urls: string[];
  sample_lines: string[];
  is_active: boolean;
  sort_order: number;
}

export interface Conversation {
  id: string;
  user_id: string;
  character_id: string;
  created_at: string;
  last_message_at: string;
  character?: Character;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  kind: MessageKind;
  image_id: string | null;
  source: MessageSource;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface AccessState {
  trial_active: boolean;
  trial_seconds_left: number;
  trial_started_at: string | null;
  /** Eligible to start the free 3-min trial on first message */
  trial_eligible?: boolean;
  has_active_subscription: boolean;
  wallet_balance: number;
  free_images_left: number;
  can_chat: boolean;
  can_call: boolean;
  can_generate_image: boolean;
  is_banned: boolean;
  daily_messages_used: number;
  daily_message_cap: number;
  image_price_paise: number;
  video_paise_per_min: number;
  video_min_balance_paise: number;
  phone_verified: boolean;
  onboarding_complete: boolean;
  gender: Gender | null;
  require_phone_verification: boolean;
}

export interface SubPlan {
  key: string;
  name: string;
  price_paise: number;
  period_days: number;
  razorpay_plan_id: string;
}

export interface WalletPack {
  key: string;
  amount_inr: number;
  paise: number;
  label: string;
}

export interface AppSettingsMap {
  trial_chat_seconds: number;
  trial_free_images: number;
  video_paise_per_min: number;
  video_min_balance_paise: number;
  image_price_paise: number;
  sub_daily_message_cap: number;
  max_call_seconds: number;
  require_phone_verification: boolean;
  data_retention_days: number;
  sub_plans: Record<string, SubPlan>;
  wallet_packs: WalletPack[];
  gst_rate_bps: number;
}
