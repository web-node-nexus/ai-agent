# TaraWorld

AI companion chat + video calls for India — Hinglish characters, OTP login, wallet + subscription billing (Razorpay), and a role-gated admin console.

Companions are clearly labeled AI. Romance stays PG-13. Paywalls live in the product UI, not in character dialogue.

## Stack

- **App:** Next.js (App Router) + React 19 + Tailwind CSS 4
- **Auth / DB:** Supabase Auth + Postgres (RLS) + Storage
- **AI:** Anthropic Claude (chat), Google Gemini (Live voice + image gen)
- **Payments:** Razorpay (orders, subscriptions, webhooks)
- **OTP:** MSG91
- **Rate limits:** Upstash Redis
- **Process:** Node 20+, PM2 on VPS (see [DEPLOY.md](./DEPLOY.md))

## Environment

Copy `.env.example` → `.env.local` (gitignored). Never commit secrets.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser / SSR anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service role (admin APIs, RPCs) |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (auth redirects, SEO) |
| `ANTHROPIC_API_KEY` / `CLAUDE_*_MODEL` | Chat models |
| `GEMINI_API_KEY` / `GEMINI_LIVE_MODEL` / `GEMINI_IMAGE_MODEL` | Voice + images |
| `RAZORPAY_*` / `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Payments + webhook verify |
| `MSG91_AUTH_KEY` / `MSG91_TEMPLATE_ID` | Phone OTP |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting |
| `CRON_SECRET` | Protects `/api/cron/cleanup` |
| `ADMIN_BOOTSTRAP_EMAIL` | Optional ops note for first admin |

## Character images (`/public/characters/`)

Seeded characters use folders:

```
public/characters/<slug>/
  cover.svg          # or cover.webp / cover.jpg
  ref1.svg …         # reference stills for image gen
  avatar.vrm         # optional 3D avatar
```

**To replace art:**

1. Drop new files into the matching slug folder (keep filenames or update DB URLs).
2. Prefer WebP/JPG for photos; SVG placeholders ship for local/dev.
3. Update `characters.cover_url` and `reference_image_urls` in Supabase (Admin → Characters, or SQL) if paths change.
4. Optionally mirror covers into the public Supabase Storage bucket `characters` for CDN delivery.

Slugs today: `aanya`, `riya`, `meher`, `naina`, `arjun`, `kabir`, `vihaan`, `rohan`.

## Supabase migrations

```bash
# Install CLI: https://supabase.com/docs/guides/cli
supabase link --project-ref <your-ref>
supabase db push
# or apply SQL manually in the dashboard:
#   supabase/migrations/20250101000001_init_schema.sql
#   supabase/migrations/20250101000002_seed.sql
```

After first login, promote an admin (see `supabase/seed_admin.sql`):

```sql
update public.profiles set role = 'admin' where id = '<auth-user-uuid>';
```

Create Storage buckets (also documented in DEPLOY.md):

- `characters` — **public**
- `generated-images` — **private**

## Local development

```bash
npm install
cp .env.example .env.local   # fill values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Admin: [http://localhost:3000/admin](http://localhost:3000/admin) (requires `profiles.role = 'admin'`).

Middleware already gates `/admin` to admins; every `/api/admin/*` route re-checks via service client (`requireAdmin()`).

## Product test checklist

Use this against staging before each release:

| Area | Check |
|---|---|
| **Under-18** | Onboarding DOB / age confirm blocks under-18; no access to `/app` without confirm |
| **Trial 3 min** | New user gets ~180s trial chat (`trial_chat_seconds`); timer + paywall after |
| **2 free images** | Trial allows `trial_free_images` (default 2); further gens require wallet/sub |
| **Wallet idempotency** | Replaying the same Razorpay payment / ledger `ref_id` does not double-credit |
| **Call billing** | Start → heartbeat → end charges `video_paise_per_min`; balance floor enforced |
| **Gender match** | Users only see / start chats with opposite-gender companions per product rules |
| **RLS** | Anon/authenticated clients cannot read others’ messages, wallets, or private images |
| **Admin ban** | Ban from Admin → Users redirects user to `/banned` and blocks API access |

Also smoke-test: OTP login, subscription create/cancel, Razorpay webhook, image confirm hold/capture, report flow, cron cleanup with `CRON_SECRET`.

## Admin panel

`/admin` sidebar: Dashboard, Users, Characters, Settings, Payments, Calls, Images, Moderation, Audit.

APIs under `/api/admin/*` all call `requireAdmin()` (auth + `role === 'admin'`).

## Deploy

Production on a VPS with PM2 + Nginx + Certbot: see **[DEPLOY.md](./DEPLOY.md)**.

## Scripts

| Command | |
|---|---|
| `npm run dev` | Local Next.js |
| `npm run build` | Production build |
| `npm start` | Serve build (port 3000) |
| `npm run lint` | ESLint |
