
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-images', 'task-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read task images"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-images');

CREATE POLICY "Users upload own task images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own task images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'task-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own task images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-images' AND auth.uid()::text = (storage.foldername(name))[1]);
