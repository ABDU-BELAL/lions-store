## Bilingual Site (Arabic + English)

A language toggle in the header switches the entire site between Arabic (RTL) and English (LTR). Selection is saved per device (localStorage) so users keep their choice.

### What gets translated

**1. All UI text** — every page, button, label, error, badge, menu, footer link:
- Header / bottom nav / menu / WhatsApp tooltip
- Home, Shop, Categories, Search, Product page, Collection page
- Top-up flow + receipt upload + status
- Transactions, Notifications, Profile
- Login, Signup, Forgot password, Reset password
- About, Privacy, Terms, Payments
- Admin panel (all tabs: products, collections, banners, orders, top-ups, users, settings)
- All toasts and error messages

**2. Product & collection content** — names AND descriptions:
- Add `title_en` and `description_en` columns to `products`
- Add `title_en` and `description_en` columns to `collections`
- Add `title_en` to `banners` (optional caption)
- When language = EN, show the English value; fall back to Arabic if the English field is empty
- Admin product/collection/banner editors get a second tab "English" with the EN fields

**3. Layout direction**
- Arabic → `dir="rtl"`, fonts and spacing as today
- English → `dir="ltr"`, mirrored layout automatically

**4. Numbers & currency**
- Arabic: "EG 1,250" with Arabic-Indic option later if requested
- English: "EGP 1,250"

### What stays the same
- Brand name "LION STORE" / "Lion Store" — kept in Latin in both languages
- User-entered data (their full name, game IDs, custom_id, phone) is never translated
- Telegram notifications stay in Arabic (admin-facing)

### Technical notes
- New `src/i18n/` folder with `ar.ts` and `en.ts` dictionaries, a `LanguageProvider`, and a `useT()` hook
- `<html lang>` and `<body dir>` switched at the root route
- Migration adds the new columns, backfills `title_en := title` so nothing breaks before admin fills them in
- Default language stays Arabic for first-time visitors

### Out of scope (per your earlier message)
- Auto-fulfillment API framework — you'll tell me when to start
