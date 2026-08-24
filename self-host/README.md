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

## 7. Partner / reseller API

Schema: run `03_partner_api.sql` in the SQL Editor (it is also appended to the
end of `01_schema.sql`). It adds the `partner` role value plus the
`partner_api_keys` and `partner_orders` tables (service-role only, RLS on).

### Creating a key

Admin dashboard → tab **شركاء API** (super admin only): search for the user
account, optionally name the key, press **إنشاء المفتاح**. The plaintext key
(`pk_…`) is shown **once** — only its SHA-256 hash is stored. Creating a key
also grants the account the `partner` role and makes sure it has a wallet.
Keys can be disabled (مفعل/معطل) or deleted at any time.

The partner is a normal account: top up its wallet the usual way, and every
API order is charged against that wallet.

### Authentication

Send the key on every request:

```
api-token: pk_xxxxxxxx
```

(`Authorization: Bearer pk_…` and `x-api-token` also work.)

### Endpoints

`GET /api/partner/products`

```json
{ "status": "ok", "products": [
  { "id": "uuid", "name": "...", "name_en": "...", "price": 100,
    "price_usd": 2, "stock": "available",
    "quantity_enabled": false, "unit_size": null,
    "min_quantity": null, "max_quantity": null } ] }
```

`POST /api/partner/order`

```json
{ "product_id": "uuid", "quantity": 1, "player_id": "123456", "order_uid": "your-ref-001" }
```

- `quantity` required only when `quantity_enabled` is true.
- `player_id` required unless the product's field mode is `none`.
- `order_uid` is your own reference and must be unique per partner (idempotency).

Response:

```json
{ "status": "ok", "order_id": "uuid", "order_uid": "your-ref-001",
  "product": "...", "price": 100, "order_status": "pending" }
```

The order is charged from the partner wallet and enters the same
auto-fulfillment pipeline as storefront orders.

`GET /api/partner/order/:id` — `:id` is either the returned `order_id` (UUID)
or your own `order_uid`.

```json
{ "status": "ok", "order_id": "uuid", "order_uid": "your-ref-001",
  "product": "...", "quantity": 1, "player_id": "123456", "price": 100,
  "order_status": "completed", "provider_status": "accept",
  "refunded": false, "created_at": "..." }
```

### Error codes

| code | HTTP | meaning |
|---|---|---|
| `invalid_token` | 401 | missing/unknown api-token |
| `inactive_partner` | 403 | key disabled or account suspended |
| `invalid_request` | 400 | bad/missing parameters |
| `product_not_found` | 404 | product missing or inactive |
| `out_of_stock` | 409 | product marked out of stock |
| `insufficient_balance` | 402 | partner wallet too low |
| `duplicate_order` | 409 | `order_uid` already used (returns `order_id`) |
| `order_not_found` | 404 | unknown order for this partner |
| `rate_limited` | 429 | more than 120 order calls per minute |
| `server_error` | 500 | internal error |

Error shape: `{ "status": "error", "code": "...", "message": "..." }`
