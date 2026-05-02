import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Facebook, Unlink, CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import {
  getFacebookConnection,
  disconnectFacebook,
  saveFacebookApp,
} from "@/server/facebook.functions";
import { toast } from "sonner";

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
      { name: "description", content: "Connect Facebook using your Meta App." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <SettingsPage />
    </RequireAuth>
  ),
});

type Conn = { page_id: string; page_name: string | null; app_id: string | null };

function SettingsPage() {
  const { session } = useAuth();
  const getConn = useServerFn(getFacebookConnection);
  const disconnect = useServerFn(disconnectFacebook);
  const saveApp = useServerFn(saveFacebookApp);

  const [conn, setConn] = useState<Conn | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");

  // Flash messages from OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fb = params.get("fb");
    const msg = params.get("msg");
    if (fb === "ok" && msg) toast.success(msg);
    if (fb === "error" && msg) toast.error(msg);
    if (fb) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const { connection } = await getConn();
      setConn(
        connection
          ? {
              page_id: connection.page_id,
              page_name: connection.page_name,
              app_id: connection.app_id,
            }
          : null,
      );
      if (connection?.app_id) setAppId(connection.app_id);
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

  const handleSaveApp = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveApp({ data: { appId, appSecret } });
      toast.success("App credentials saved. Now click Connect Facebook.");
      setAppSecret("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const startConnect = () => {
    if (!session?.user?.id) return toast.error("Please sign in first");
    if (!conn?.app_id) return toast.error("Save your App ID and Secret first");
    const redirectUri = `${window.location.origin}/api/public/facebook/callback`;
    const url =
      `https://www.facebook.com/v21.0/dialog/oauth?` +
      new URLSearchParams({
        client_id: conn.app_id,
        redirect_uri: redirectUri,
        state: session.user.id,
        scope: FB_SCOPES,
        response_type: "code",
      });
    window.location.href = url;
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Facebook? This removes your saved app credentials too.")) return;
    try {
      await disconnect();
      toast.success("Disconnected");
      setConn(null);
      setAppId("");
      setAppSecret("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const isPageConnected = Boolean(conn?.page_id);
  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/facebook/callback`
      : "";

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
                Connect a Page using your own Meta App
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              {isPageConnected && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-background p-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-chart-2" />
                  Connected to{" "}
                  <span className="font-medium">{conn?.page_name ?? conn?.page_id}</span>
                </div>
              )}

              {/* Step 1: App credentials */}
              <form onSubmit={handleSaveApp} className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Step 1 — Meta App credentials
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="appId">App ID (Client ID)</Label>
                  <Input
                    id="appId"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="e.g. 1542307289296208"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="appSecret">App Secret</Label>
                  <Input
                    id="appSecret"
                    type="password"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder={conn?.app_id ? "•••••••• (enter to update)" : "Meta App Secret"}
                    required
                  />
                </div>
                <p className="rounded-md border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
                  Add this <span className="font-medium">OAuth Redirect URI</span> in your Meta
                  App → Facebook Login settings:
                  <br />
                  <code className="break-all">{redirectUri}</code>
                </p>
                <Button type="submit" variant="outline" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving…" : "Save app credentials"}
                </Button>
              </form>

              {/* Step 2: OAuth */}
              <div className="mt-6 space-y-3 border-t border-border pt-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Step 2 — Connect your Page
                </div>
                <p className="text-sm text-muted-foreground">
                  Authorize the app to post on your Facebook Page on your behalf.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={startConnect}
                    disabled={!conn?.app_id}
                    className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
                  >
                    <Facebook className="mr-2 h-4 w-4" />
                    {isPageConnected ? "Reconnect Facebook" : "Connect Facebook"}
                  </Button>
                  {conn && (
                    <Button type="button" variant="outline" onClick={handleDisconnect}>
                      <Unlink className="mr-2 h-4 w-4" /> Disconnect
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
