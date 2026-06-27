DROP POLICY IF EXISTS "Users create own topups" ON public.topup_requests;
CREATE POLICY "Users create own topups" ON public.topup_requests
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'::topup_status
  AND NOT is_banned(auth.uid())
  AND (
    (method = 'binance' AND amount >= 50)
    OR (method <> 'binance' AND amount >= 100)
  )
);