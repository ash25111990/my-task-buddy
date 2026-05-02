import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Facebook, Unlink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequireAuth } from "@/components/RequireAuth";
import { useServerFn } from "@tanstack/react-start";
import {
  getFacebookConnection,
  disconnectFacebook,
  saveFacebookConnection,
} from "@/server/facebook.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Calendar" },
      { name: "description", content: "Connect Facebook by providing your app credentials." },
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
  const getConn = useServerFn(getFacebookConnection);
  const disconnect = useServerFn(disconnectFacebook);
  const save = useServerFn(saveFacebookConnection);
  const [conn, setConn] = useState<Conn | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [pageId, setPageId] = useState("");
  const [pageAccessToken, setPageAccessToken] = useState("");

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
      if (connection?.page_id) setPageId(connection.page_id);
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

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await save({
        data: { appId, appSecret, pageId, pageAccessToken },
      });
      toast.success(`Connected${res.pageName ? ` to ${res.pageName}` : ""}`);
      setAppSecret("");
      setPageAccessToken("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Facebook?")) return;
    try {
      await disconnect();
      toast.success("Disconnected");
      setConn(null);
      setAppId("");
      setAppSecret("");
      setPageId("");
      setPageAccessToken("");
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
                Use your own Meta App credentials to post tasks to a Page
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              {conn && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-background p-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-chart-2" />
                  Connected
                  {conn.page_name ? (
                    <>
                      {" to "}
                      <span className="font-medium">{conn.page_name}</span>
                    </>
                  ) : null}
                  <span className="ml-auto text-xs text-muted-foreground">
                    Page {conn.page_id}
                  </span>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="appId">App ID</Label>
                  <Input
                    id="appId"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="Meta App (Client) ID"
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
                    placeholder={conn ? "•••••••• (enter to update)" : "Meta App Secret"}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pageId">Page ID</Label>
                  <Input
                    id="pageId"
                    value={pageId}
                    onChange={(e) => setPageId(e.target.value)}
                    placeholder="Facebook Page ID"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pageAccessToken">Page Access Token</Label>
                  <Input
                    id="pageAccessToken"
                    type="password"
                    value={pageAccessToken}
                    onChange={(e) => setPageAccessToken(e.target.value)}
                    placeholder={conn ? "•••••••• (enter to update)" : "Long-lived Page access token"}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Generate a long-lived Page Access Token in Graph API Explorer with
                    <span className="font-mono"> pages_manage_posts</span> and
                    <span className="font-mono"> pages_read_engagement</span> scopes.
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
                  >
                    <Facebook className="mr-2 h-4 w-4" />
                    {saving ? "Saving…" : conn ? "Update credentials" : "Connect"}
                  </Button>
                  {conn && (
                    <Button type="button" variant="outline" onClick={handleDisconnect}>
                      <Unlink className="mr-2 h-4 w-4" /> Disconnect
                    </Button>
                  )}
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
