ALTER TABLE public.facebook_connections
  ALTER COLUMN page_name DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS app_id text,
  ADD COLUMN IF NOT EXISTS app_secret text;