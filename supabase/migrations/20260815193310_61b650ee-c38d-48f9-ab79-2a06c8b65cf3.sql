CREATE TABLE IF NOT EXISTS public.request_locks (
  key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.request_locks TO service_role;
ALTER TABLE public.request_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all client access on request_locks" ON public.request_locks;
CREATE POLICY "Deny all client access on request_locks" ON public.request_locks
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.claim_request_lock(p_key text, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_ok boolean;
BEGIN
  DELETE FROM public.request_locks WHERE created_at < now() - interval '1 day';
  INSERT INTO public.request_locks (key, created_at)
  VALUES (p_key, now())
  ON CONFLICT (key) DO UPDATE SET created_at = now()
    WHERE public.request_locks.created_at < now() - make_interval(secs => p_window_seconds)
  RETURNING true INTO v_ok;
  RETURN COALESCE(v_ok, false);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_request_lock(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_request_lock(text, integer) FROM anon, authenticated;