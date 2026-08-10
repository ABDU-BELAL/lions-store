-- Storage buckets for the self-hosted Supabase project.
-- Run AFTER 01_schema.sql (the object policies live in that file).
-- All buckets are PRIVATE; the app serves files through /api/public/img/*.

insert into storage.buckets (id, name, public)
values
  ('banners',        'banners',        false),
  ('products',       'products',       false),
  ('topup-receipts', 'topup-receipts', false)
on conflict (id) do nothing;
