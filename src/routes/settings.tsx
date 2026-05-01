import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Facebook, Unlink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import {
  getFacebookConnection,
  disconnectFacebook,
} from "@/server/facebook.functions";
import { toast } from "sonner";

const FB_APP_ID = "1542307289296208";
// Permissions needed to publish to a Page on the user's behalf
const FB_SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
].join(",");

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Calendar" },
      { name: "description", content: "Connect integrations like Facebook." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <SettingsPage />
    </RequireAuth>
  ),
});

function SettingsPage() {
  const { session } = useAuth();
  const router = useRouter();
  const getConn = useServerFn(getFacebookConnection);
  const disconnect = useServerFn(disconnectFacebook);
  const [conn, setConn] = useState<{ page_id: string; page_name: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  // Read flash messages from query params after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fb = params.get("fb");
    const msg = params.get("msg");
    if (fb === "ok" && msg) toast.success(msg);
    if (fb === "error" && msg) toast.error(msg);
    if (fb) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const { connection } = await getConn();
      setConn(connection ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startConnect = () => {
    if (!session?.user?.id) {
      toast.error("Please sign in first");
      return;
    }
    const redirectUri = `${window.location.origin}/api/public/facebook/callback`;
    const url =
      `https://www.facebook.com/v21.0/dialog/oauth?` +
      new URLSearchParams({
        client_id: FB_APP_ID,
        redirect_uri: redirectUri,
        state: session.user.id,
        scope: FB_SCOPES,
        response_type: "code",
      });
    window.location.href = url;
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Facebook?")) return;
    try {
      await disconnect();
      toast.success("Disconnected");
      setConn(null);
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-4 py-8 md:py-12">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to calendar
        </Link>
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Manage integrations for your account.
        </p>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1877F2]/10 text-[#1877F2]">
              <Facebook className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Facebook</h2>
              <p className="text-xs text-muted-foreground">
                Post and update tasks on your Facebook Page
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : conn ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-chart-2" />
                Connected to <span className="font-medium">{conn.page_name}</span>
              </div>
              <Button variant="outline" onClick={handleDisconnect}>
                <Unlink className="mr-2 h-4 w-4" /> Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect a Facebook Page to share your tasks. You'll be redirected
                to Facebook to authorize.
              </p>
              <Button onClick={startConnect} className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                <Facebook className="mr-2 h-4 w-4" /> Connect Facebook
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
