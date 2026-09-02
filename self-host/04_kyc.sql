-- KYC verification + per-payment-method KYC requirement
-- Run this in your own Supabase project's SQL Editor (safe to re-run).

-- 1) Profile KYC status: none | pending | approved | rejected
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'none';

-- 2) KYC requests
CREATE TABLE IF NOT EXISTS public.kyc_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('passport', 'id_card', 'residence_permit')),
  paths text[] NOT NULL,
  full_name text,
  document_number text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS kyc_requests_user_idx ON public.kyc_requests(user_id);
CREATE INDEX IF NOT EXISTS kyc_requests_status_idx ON public.kyc_requests(status);

GRANT SELECT ON public.kyc_requests TO authenticated;
GRANT ALL ON public.kyc_requests TO service_role;

ALTER TABLE public.kyc_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc read own" ON public.kyc_requests;
CREATE POLICY "kyc read own" ON public.kyc_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "kyc service role" ON public.kyc_requests;
CREATE POLICY "kyc service role" ON public.kyc_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) Private storage bucket for KYC documents (all access via service role)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-docs', 'kyc-docs', false)
ON CONFLICT (id) DO NOTHING;
