CREATE TABLE IF NOT EXISTS public.catalog_collection_runs (
  id text PRIMARY KEY,
  updated_at text NOT NULL,
  payload text NOT NULL
);
ALTER TABLE public.catalog_collection_runs ENABLE ROW LEVEL SECURITY;
