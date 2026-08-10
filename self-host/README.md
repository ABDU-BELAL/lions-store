# Moving this store to your own Supabase

Everything the app needs is in this folder. Nothing here is Lovable-specific.

## 1. Create the database

In your Supabase project → SQL editor, run in order:

1. `01_schema.sql` — all tables, enums, RLS policies, grants, functions and triggers
   (generated from every migration this project has applied, in order).
2. `02_storage.sql` — the three storage buckets (`banners`, `products`, `topup-receipts`).

## 2. Auth settings (Supabase Dashboard → Authentication)

- Enable **Email/password**. Disable anonymous sign-ins.
- Enable **Google** provider if you want Google sign-in, and add your own
  Google OAuth client id/secret. (The Lovable OAuth broker will not exist
  outside Lovable — see `src/integrations/lovable/index.ts`; replace that call
  with `supabase.auth.signInWithOAuth({ provider: 'google' })`.)
- URL configuration → Site URL: `https://lions-stores.com`,
  Redirect URLs: your domain + `http://localhost:8080`.

## 3. Environment variables

Client (build-time):

```
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon / publishable key>
VITE_SUPABASE_PROJECT_ID=<your-ref>
```

Server (runtime secrets on your host):

```
SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon / publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>

# Fulfillment providers
BRAND1_API_BASE=      BRAND1_API_TOKEN=
X3_API_BASE=          X3_API_TOKEN=
YASSEN_API_TOKEN=
SAMA_API_BASE=        SAMA_API_TOKEN=

# Telegram bot
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_REGISTER_PASSWORD=

# Cron auth for /api/public/hooks/fulfillment-poll
CRON_SECRET=
```

No other secret is required. `LOVABLE_API_KEY` is not used by any runtime code path.

## 4. First admin

Sign up in the app, then in SQL editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'super_admin' from auth.users where email = 'you@example.com'
on conflict do nothing;
```

## 5. Moving existing data

Schema only is covered above. To carry rows/images over, export from the
current backend (Cloud → Advanced settings → Export data) while it is active,
then import the dump into your Supabase project. Storage files must be copied
bucket-to-bucket separately.

## 6. Order polling

Point a cron (Supabase scheduled function, GitHub Action, cron-job.org …) at:

```
POST https://<your-domain>/api/public/hooks/fulfillment-poll
Header: x-cron-secret: <CRON_SECRET>
```
