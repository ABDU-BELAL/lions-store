
DO $$ BEGIN
  CREATE POLICY "Users upload own topup receipts" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'topup-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users read own topup receipts" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'topup-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
