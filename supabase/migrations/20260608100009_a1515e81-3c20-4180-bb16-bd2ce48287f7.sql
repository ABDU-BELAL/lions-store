CREATE INDEX IF NOT EXISTS orders_user_created_idx ON public.orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS topup_requests_user_created_idx ON public.topup_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS topup_requests_status_created_idx ON public.topup_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS products_active_sort_idx ON public.products (is_active, sort_order, created_at DESC);