ALTER TABLE public.products DROP CONSTRAINT products_provider_check;
ALTER TABLE public.products ADD CONSTRAINT products_provider_check CHECK (provider IS NULL OR provider IN ('brand1','x3'));