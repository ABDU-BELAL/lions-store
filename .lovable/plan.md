## Goal
Let each collection have child collections (subcategories). Each subcategory has its own page, its own products, and full admin CRUD with AR + EN names — same as top-level collections.

Example: **PUBG** (parent) → **UC**, **Royal Pass** (children, each with its own products).

## Database
Single migration on `public.collections`:
- Add `parent_id uuid REFERENCES public.collections(id) ON DELETE CASCADE` (nullable).
- Add index on `parent_id`.
- Existing rows stay top-level (`parent_id = NULL`). No data loss.

## Backend (`src/lib/collections.functions.ts`)
- `listActiveCollections` → keep current behavior (returns only top-level: `parent_id IS NULL`) so the home/Categories page is unchanged.
- `getCollectionBySlug` → also fetch children. Response shape:
  ```
  { collection, children: [...], products: [...] }
  ```
  If `children.length > 0`, the page renders children. Otherwise it renders products (current behavior).
- `adminListCollections` → return all rows including `parent_id` so admin can see/manage both levels.
- `adminUpsertCollection` → accept optional `parent_id` (uuid or null). Validation:
  - A collection can't be its own parent.
  - Only 2 levels: a child cannot itself be a parent (reject if `parent_id` points to a row that already has a parent).
- `adminDeleteCollection` → unchanged; DB cascade removes children.

## Frontend

**Collection page `/collection/$slug`** (`src/routes/collection.$slug.tsx`):
- If the collection has children → render a grid of child cards (image + AR/EN title), each linking to `/collection/<childSlug>`. Hide the products grid and purchase modal.
- If no children → current product grid + purchase flow (unchanged).
- Breadcrumb at top: `Categories › Parent › Current` (uses parent info when present).

**Categories page `/categories`**: unchanged — still lists top-level only.

**Admin dashboard** (`src/routes/admin.tsx`, collections section):
- Add a "Parent category" dropdown in the collection editor (options = all top-level collections, plus "— None (top-level)"). AR + EN title fields already exist.
- In the collections list, group children visually under their parent (indent + small "↳" marker) and show a "Parent: X" label.
- Product editor unchanged — products still pick a single `collection_id` (now typically a leaf/child collection, but parent-level still allowed for backward compat).

## i18n
All new admin labels and the breadcrumb use `useLang()` with AR + EN strings (e.g. "القسم الأب" / "Parent category", "أقسام فرعية" / "Subcategories").

## Out of scope
- Deeper nesting (3+ levels) — blocked by validation.
- Moving existing products between collections in bulk — admin still edits one product at a time.
- Auto-fulfillment API (waiting for your go-ahead).
