
CREATE OR REPLACE FUNCTION public.gen_custom_id()
RETURNS varchar
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id varchar(8);
  v_attempts int := 0;
BEGIN
  LOOP
    v_id := lpad((floor(random() * 90000000) + 10000000)::text, 8, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE custom_id = v_id);
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN RAISE EXCEPTION 'Could not generate unique custom_id'; END IF;
  END LOOP;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gen_custom_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_banned(uuid) FROM PUBLIC, anon;
