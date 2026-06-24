ALTER TABLE public.collections ADD COLUMN parent_id uuid REFERENCES public.collections(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS collections_parent_id_idx ON public.collections(parent_id);