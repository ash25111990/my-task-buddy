import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GRAPH = "https://graph.facebook.com/v21.0";

export const getFacebookConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("facebook_connections")
      .select("page_id, page_name, updated_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { connection: data };
  });

export const disconnectFacebook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("facebook_connections")
      .delete()
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const postTaskToFacebook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string }) =>
    z.object({ taskId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: task, error: tErr } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", data.taskId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!task) throw new Error("Task not found");

    const { data: conn, error: cErr } = await supabase
      .from("facebook_connections")
      .select("page_id, page_access_token")
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!conn) throw new Error("Facebook is not connected");

    const status = task.done ? "✅ Completed" : "🗓️ Task";
    const when = task.time ? `${task.date} at ${task.time}` : task.date;
    const message = `${status}: ${task.title}\n📅 ${when}\n🏷️ ${task.category} • Priority: ${task.priority}`;

    const isUpdate = Boolean(task.fb_post_id);
    const url = isUpdate
      ? `${GRAPH}/${task.fb_post_id}`
      : `${GRAPH}/${conn.page_id}/feed`;

    const body = new URLSearchParams({
      message,
      access_token: conn.page_access_token,
    });

    const res = await fetch(url, { method: "POST", body });
    const json = (await res.json()) as { id?: string; error?: { message: string } };
    if (!res.ok || json.error) {
      throw new Error(json.error?.message ?? `Facebook API error (${res.status})`);
    }

    if (!isUpdate && json.id) {
      const { error: uErr } = await supabase
        .from("tasks")
        .update({ fb_post_id: json.id })
        .eq("id", task.id);
      if (uErr) throw new Error(uErr.message);
    }

    return { ok: true, postId: json.id ?? task.fb_post_id, updated: isUpdate };
  });
