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
      .select("page_id, page_name, app_id, updated_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { connection: data };
  });

const saveSchema = z.object({
  appId: z.string().trim().min(1, "App ID required").max(64),
  appSecret: z.string().trim().min(1, "App Secret required").max(128),
  pageId: z.string().trim().min(1, "Page ID required").max(64),
  pageAccessToken: z.string().trim().min(10, "Page Access Token required").max(2048),
  pageName: z.string().trim().max(120).optional().nullable(),
});

export const saveFacebookConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Validate the token by hitting the Graph API for the page
    const verify = await fetch(
      `${GRAPH}/${data.pageId}?fields=id,name&access_token=${encodeURIComponent(data.pageAccessToken)}`,
    );
    const verifyJson = (await verify.json()) as {
      id?: string;
      name?: string;
      error?: { message: string };
    };
    if (!verify.ok || verifyJson.error || !verifyJson.id) {
      throw new Error(
        verifyJson.error?.message ??
          "Could not verify Page credentials. Check the Page ID and Access Token.",
      );
    }

    const { error } = await supabase.from("facebook_connections").upsert({
      user_id: userId,
      app_id: data.appId,
      app_secret: data.appSecret,
      page_id: data.pageId,
      page_access_token: data.pageAccessToken,
      page_name: data.pageName?.trim() || verifyJson.name || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true, pageName: verifyJson.name };
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
