ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS show_frame boolean NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS show_frame boolean NOT NULL DEFAULT true;