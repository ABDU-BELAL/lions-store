CREATE OR REPLACE FUNCTION public.protect_vip_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.is_admin(auth.uid()) THEN
    IF NEW.vip_level IS DISTINCT FROM OLD.vip_level THEN
      RAISE EXCEPTION 'forbidden: vip_level is read-only';
    END IF;
    IF NEW.vip_assigned_by IS DISTINCT FROM OLD.vip_assigned_by THEN
      RAISE EXCEPTION 'forbidden: vip_assigned_by is read-only';
    END IF;
    IF NEW.vip_assigned_at IS DISTINCT FROM OLD.vip_assigned_at THEN
      RAISE EXCEPTION 'forbidden: vip_assigned_at is read-only';
    END IF;
    IF NEW.lifetime_spend IS DISTINCT FROM OLD.lifetime_spend THEN
      RAISE EXCEPTION 'forbidden: lifetime_spend is read-only';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;