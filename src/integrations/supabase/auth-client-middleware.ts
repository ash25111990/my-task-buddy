import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

/**
 * Client middleware: attach the current Supabase access token as a
 * Bearer Authorization header so the server-side `requireSupabaseAuth`
 * middleware can authenticate the request.
 */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    return next({ sendContext: {}, headers });
  },
);
