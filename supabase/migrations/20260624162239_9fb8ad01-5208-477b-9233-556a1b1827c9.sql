ALTER TABLE public.products ADD COLUMN IF NOT EXISTS title_en text, ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS title_en text, ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS title_en text;
UPDATE public.products SET title_en = title WHERE title_en IS NULL;
UPDATE public.collections SET title_en = title WHERE title_en IS NULL;