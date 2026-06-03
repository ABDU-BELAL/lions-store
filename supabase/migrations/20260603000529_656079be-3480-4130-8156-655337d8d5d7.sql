
CREATE POLICY "Admins upload banners" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'banners' AND is_admin(auth.uid()));

CREATE POLICY "Admins update banners" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'banners' AND is_admin(auth.uid()));

CREATE POLICY "Admins delete banners" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'banners' AND is_admin(auth.uid()));
