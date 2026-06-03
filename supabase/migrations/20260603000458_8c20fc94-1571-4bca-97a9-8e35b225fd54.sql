
CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  link_url text,
  title text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.banners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone views active banners" ON public.banners
  FOR SELECT TO anon, authenticated
  USING (is_active OR is_admin(auth.uid()));

CREATE POLICY "Admins manage banners insert" ON public.banners
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins manage banners update" ON public.banners
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins manage banners delete" ON public.banners
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER banners_touch_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
