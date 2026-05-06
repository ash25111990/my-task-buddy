
-- Make tasks user-specific
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS user_id uuid;

-- Remove legacy shared tasks (no owner)
DELETE FROM public.tasks WHERE user_id IS NULL;

ALTER TABLE public.tasks ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);

-- Replace permissive RLS policies with user-scoped ones
DROP POLICY IF EXISTS "Authenticated can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can delete tasks" ON public.tasks;

CREATE POLICY "Users view own tasks" ON public.tasks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own tasks" ON public.tasks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
