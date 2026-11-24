# TaraWorld production deploy (VPS + PM2 + Nginx)

HTTPS is **mandatory**. Do not expose the Node process directly to the public internet.

## 1. Server prep

- Ubuntu 22.04+ (or similar)
- Node.js **≥ 20.9**
- Nginx, Certbot, PM2
- Git access to this repo

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx
sudo npm i -g pm2
```

## 2. App directory

```bash
sudo mkdir -p /var/www/taraworld
sudo chown "$USER":"$USER" /var/www/taraworld
cd /var/www/taraworld
git clone <your-repo-url> .
cp .env.example .env.local   # fill ALL secrets on the server only
npm ci
npm run build
```

Never commit `.env.local`. Keep it mode `600` on the host.

## 3. PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # follow the printed systemd command
```

Useful: `pm2 logs taraworld`, `pm2 restart taraworld`.

After pulls:

```bash
git pull && npm ci && npm run build && pm2 restart taraworld
```

## 4. Nginx

Sample config: [`deploy/nginx.taraworld.conf`](./deploy/nginx.taraworld.conf).

```bash
sudo cp deploy/nginx.taraworld.conf /etc/nginx/sites-available/taraworld
# edit server_name + SSL paths
sudo ln -sf /etc/nginx/sites-available/taraworld /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Critical: SSE / chat streaming

For `/api/chat` (and any streaming responses), **turn proxy buffering off** so tokens flush to the client:

```nginx
location /api/chat {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_buffering off;
  proxy_cache off;
  chunked_transfer_encoding on;
  proxy_read_timeout 3600s;
}
```

Also raise timeouts for Gemini Live call routes if needed.

## 5. HTTPS (Certbot) — required

```bash
sudo certbot --nginx -d taraworld.in -d www.taraworld.in
sudo certbot renew --dry-run
```

Redirect all HTTP → HTTPS. HSTS optional but recommended after confirming clients.

## 6. Cron: cleanup

Hit the cleanup endpoint daily (auth with `CRON_SECRET`):

```cron
# /etc/cron.d/taraworld-cleanup
0 3 * * * root curl -fsS -X POST -H "Authorization: Bearer ${CRON_SECRET}" https://taraworld.in/api/cron/cleanup >/var/log/taraworld-cleanup.log 2>&1
```

Or use a systemd timer. Prefer storing the secret in a root-only env file sourced by the cron job — do not paste the real secret into a world-readable crontab.

What cleanup does: retention / abandoned call sessions / related housekeeping (see `src/app/api/cron/cleanup/route.ts`).

## 7. Razorpay webhooks

1. Razorpay Dashboard → **Webhooks** → Add endpoint  
   `https://taraworld.in/api/webhooks/razorpay`
2. Subscribe to payment + subscription events used by the app (captured/paid, subscription activated/charged/halted/cancelled, etc.).
3. Copy the webhook secret into `RAZORPAY_WEBHOOK_SECRET` on the server.
4. Confirm signature verification succeeds with a test payment.

Also set `NEXT_PUBLIC_RAZORPAY_KEY_ID` / `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.

**Autopay:** the first Subscribe checkout creates a Razorpay Subscription (plans are auto-created and stored in `app_settings.sub_plans.razorpay_plan_id` if empty). That first payment saves a UPI Autopay / card mandate; Razorpay charges again each cycle and fires `subscription.charged` — keep those webhook events enabled.

## 8. Supabase Storage buckets

Create in the Supabase dashboard (or SQL/API):

| Bucket | Public | Use |
|---|---|---|
| `characters` | **Yes** | Optional CDN copies of character covers / refs |
| `generated-images` | **No** | User-generated images (signed URLs only) |

Policies: only service role writes; authenticated users may read their own objects in `generated-images` via signed URLs issued by the API. Do not make generated images public.

## 9. Supabase Auth URLs

Site URL + redirect allow-list must include:

- `https://taraworld.in`
- `https://taraworld.in/auth/callback`

## 10. Promote first admin

After you sign up once:

```sql
-- see supabase/seed_admin.sql
update public.profiles set role = 'admin' where id = '<uuid>';
```

Open `https://taraworld.in/admin`.

## 11. Post-deploy smoke

- [ ] HTTPS padlock + HTTP redirects
- [ ] Login / OTP
- [ ] Chat stream (no long buffer delay)
- [ ] Wallet order + webhook credit
- [ ] Subscription create
- [ ] Call start/heartbeat/end
- [ ] Cron with valid `CRON_SECRET` returns 200
- [ ] Non-admin cannot open `/admin`
- [ ] Banned user hits `/banned`
