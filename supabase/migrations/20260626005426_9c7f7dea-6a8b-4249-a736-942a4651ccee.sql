ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS purchase_field_mode text NOT NULL DEFAULT 'game_id'
  CHECK (purchase_field_mode IN ('game_id','subscription','none'));