import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login — Calendar" }] }),
  component: LoginPage,
});

type Mode = "signin" | "signup";

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const toEmail = (u: string) => (u.includes("@") ? u : `${u}@admin.local`);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const email = toEmail(username.trim());

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Welcome back");
      navigate({ to: "/" });
    } else {
      if (password.length < 6) {
        setLoading(false);
        return toast.error("Password must be at least 6 characters");
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      if (data.session) {
        toast.success("Account created");
        navigate({ to: "/" });
      } else {
        toast.success("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
      }
    }
  };

  const isSignup = mode === "signup";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {isSignup ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {isSignup ? "Create account" : "Sign in"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSignup ? "Sign up to start managing tasks" : "Use your credentials"}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username or email</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isSignup ? "yourname or you@example.com" : "admin"}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={isSignup ? 6 : undefined}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? isSignup
                ? "Creating account…"
                : "Signing in…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
