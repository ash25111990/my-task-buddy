import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GRAPH = "https://graph.facebook.com/v21.0";

export const Route = createFileRoute("/api/public/facebook/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state"); // = supabase user id
        const err = url.searchParams.get("error_description");

        const origin = url.origin;
        const redirectUri = `${origin}/api/public/facebook/callback`;
        const back = (msg: string, ok = false) =>
          Response.redirect(
            `${origin}/settings?fb=${ok ? "ok" : "error"}&msg=${encodeURIComponent(msg)}`,
            302,
          );

        if (err) return back(err);
        if (!code || !state) return back("Missing code or state");

        try {
          // 1. Exchange code -> user access token
          const tokenRes = await fetch(
            `${GRAPH}/oauth/access_token?` +
              new URLSearchParams({
                client_id: process.env.FACEBOOK_APP_ID!,
                client_secret: process.env.FACEBOOK_APP_SECRET!,
                redirect_uri: redirectUri,
                code,
              }),
          );
          const tokenJson = (await tokenRes.json()) as {
            access_token?: string;
            error?: { message: string };
          };
          if (!tokenJson.access_token)
            return back(tokenJson.error?.message ?? "Token exchange failed");

          // 2. Fetch the user's pages (use first one)
          const pagesRes = await fetch(
            `${GRAPH}/me/accounts?access_token=${tokenJson.access_token}`,
          );
          const pagesJson = (await pagesRes.json()) as {
            data?: Array<{ id: string; name: string; access_token: string }>;
            error?: { message: string };
          };
          const page = pagesJson.data?.[0];
          if (!page)
            return back(
              pagesJson.error?.message ??
                "No Facebook Page found. Create a Page and grant access.",
            );

          // 3. Upsert connection (admin client; state is the verified user id from app session)
          const { error } = await supabaseAdmin
            .from("facebook_connections")
            .upsert({
              user_id: state,
              page_id: page.id,
              page_name: page.name,
              page_access_token: page.access_token,
            });
          if (error) return back(error.message);

          return back(`Connected to ${page.name}`, true);
        } catch (e) {
          return back(e instanceof Error ? e.message : "Unknown error");
        }
      },
    },
  },
});
