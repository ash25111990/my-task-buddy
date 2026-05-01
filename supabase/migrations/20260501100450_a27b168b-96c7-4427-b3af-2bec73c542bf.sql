
CREATE TABLE public.facebook_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id text NOT NULL,
  page_name text NOT NULL,
  page_access_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facebook_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own fb connection" ON public.facebook_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own fb connection" ON public.facebook_connections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own fb connection" ON public.facebook_connections
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own fb connection" ON public.facebook_connections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER fb_conn_set_updated_at
  BEFORE UPDATE ON public.facebook_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS fb_post_id text;
