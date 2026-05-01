import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Circle,
  CheckCircle2,
  Clock,
  Flag,
  Filter,
  LogOut,
  Settings,
  Facebook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { postTaskToFacebook } from "@/server/facebook.functions";

export const Route = createFileRoute("/")({
  component: () => (
    <RequireAuth>
      <CalendarView />
    </RequireAuth>
  ),
});

type Priority = "low" | "medium" | "high";

type Task = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  priority: Priority;
  category: string;
  done: boolean;
  fbPostId?: string | null;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const priorityStyles: Record<Priority, { dot: string; badge: string; label: string }> = {
  high: {
    dot: "bg-destructive",
    badge: "bg-destructive/10 text-destructive border-destructive/20",
    label: "High",
  },
  medium: {
    dot: "bg-chart-4",
    badge: "bg-chart-4/10 text-chart-4 border-chart-4/20",
    label: "Medium",
  },
  low: {
    dot: "bg-chart-2",
    badge: "bg-chart-2/10 text-chart-2 border-chart-2/20",
    label: "Low",
  },
};

function toKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function CalendarView() {
  const today = new Date();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<"all" | Priority>("all");
  const [loading, setLoading] = useState(true);
  const [postingId, setPostingId] = useState<string | null>(null);
  const postTaskToFb = useServerFn(postTaskToFacebook);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const handlePostToFacebook = async (taskId: string) => {
    setPostingId(taskId);
    try {
      const res = await postTaskToFb({ data: { taskId } });
      toast.success(res.updated ? "Updated on Facebook" : "Posted to Facebook");
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, fbPostId: res.postId ?? t.fbPostId } : t,
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to post";
      if (/not connected/i.test(msg)) {
        toast.error("Connect Facebook in Settings first");
        navigate({ to: "/settings" });
      } else {
        toast.error(msg);
      }
    } finally {
      setPostingId(null);
    }
  };

  const loadTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("date", { ascending: true });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setTasks(
      (data ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        date: t.date,
        time: t.time ?? undefined,
        priority: t.priority as Priority,
        category: t.category,
        done: t.done,
        fbPostId: (t as { fb_post_id?: string | null }).fb_post_id ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = first.getDay();
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [cursor]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (filter !== "all" && t.priority !== filter) continue;
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return map;
  }, [tasks, filter]);

  const selectedTasks = (tasksByDay.get(toKey(selected)) ?? []).sort((a, b) =>
    (a.time ?? "99:99").localeCompare(b.time ?? "99:99"),
  );

  const monthStats = useMemo(() => {
    const inMonth = tasks.filter((t) => {
      const d = new Date(t.date + "T00:00:00");
      return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();
    });
    return {
      total: inMonth.length,
      done: inMonth.filter((t) => t.done).length,
      high: inMonth.filter((t) => t.priority === "high").length,
    };
  }, [tasks, cursor]);

  const goPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goToday = () => {
    const t = new Date();
    setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
    setSelected(t);
  };

  const toggleDone = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const next = !task.done;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: next } : t)));
    const { error } = await supabase.from("tasks").update({ done: next }).eq("id", id);
    if (error) {
      toast.error(error.message);
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !next } : t)));
    }
  };

  const goToNewTask = () => navigate({ to: "/tasks/new" });
  const goToEditTask = (id: string) =>
    navigate({ to: "/tasks/$taskId/edit", params: { taskId: id } });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Calendar
              </h1>
              <p className="text-sm text-muted-foreground">
                Plan, track and complete your tasks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
            <div className="hidden gap-1 rounded-lg border border-border bg-card p-1 md:flex">
              {(["all", "high", "medium", "low"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="md:hidden">
              <Filter className="h-4 w-4" />
            </Button>
            <Button onClick={goToNewTask} size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> New task
            </Button>
            <Button
              onClick={() => navigate({ to: "/settings" })}
              size="sm"
              variant="outline"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button onClick={handleSignOut} size="sm" variant="outline" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Stat strip */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <StatCard label="Total" value={monthStats.total} icon={<CalendarIcon className="h-4 w-4" />} />
          <StatCard label="Completed" value={monthStats.done} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
          <StatCard label="High priority" value={monthStats.high} icon={<Flag className="h-4 w-4" />} tone="danger" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Calendar grid */}
          <section className="rounded-xl border border-border bg-card p-4 md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{monthLabel}</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={goPrev} aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToday}>
                  Today
                </Button>
                <Button variant="ghost" size="icon" onClick={goNext} aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-2">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => {
                const key = toKey(d);
                const dayTasks = tasksByDay.get(key) ?? [];
                const isOtherMonth = d.getMonth() !== cursor.getMonth();
                const isToday = sameDay(d, today);
                const isSelected = sameDay(d, selected);
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(d)}
                    className={cn(
                      "group relative flex min-h-[72px] flex-col rounded-lg border p-1.5 text-left transition-all md:min-h-[96px] md:p-2",
                      "hover:border-primary/40 hover:bg-accent/40",
                      isOtherMonth
                        ? "border-transparent bg-transparent text-muted-foreground/50"
                        : "border-border bg-background",
                      isSelected && "border-primary bg-primary/5 ring-2 ring-primary/20",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                          isToday && "bg-primary text-primary-foreground",
                          !isToday && !isOtherMonth && "text-foreground",
                        )}
                      >
                        {d.getDate()}
                      </span>
                      {dayTasks.length > 0 && (
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {dayTasks.length}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-1 flex-col gap-1 overflow-hidden">
                      {dayTasks.slice(0, 2).map((t) => (
                        <div
                          key={t.id}
                          className={cn(
                            "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium md:text-xs",
                            t.done && "opacity-50 line-through",
                            t.priority === "high" && "bg-destructive/10 text-destructive",
                            t.priority === "medium" && "bg-chart-4/10 text-chart-4",
                            t.priority === "low" && "bg-chart-2/10 text-chart-2",
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", priorityStyles[t.priority].dot)} />
                          <span className="truncate">{t.title}</span>
                        </div>
                      ))}
                      {dayTasks.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{dayTasks.length - 2} more
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Selected day panel */}
          <aside className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {WEEKDAYS[selected.getDay()]}
                </p>
                <h3 className="text-2xl font-semibold text-foreground">
                  {MONTHS[selected.getMonth()].slice(0, 3)} {selected.getDate()}
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {selectedTasks.length} task{selectedTasks.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button size="icon" variant="outline" onClick={goToNewTask} aria-label="Add task">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {selectedTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
                  <CalendarIcon className="mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-foreground">No tasks</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enjoy your free day or add something
                  </p>
                </div>
              )}

              {selectedTasks.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "group flex items-start gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/40",
                    t.done && "opacity-60",
                  )}
                >
                  <button
                    onClick={() => toggleDone(t.id)}
                    className="mt-0.5 text-muted-foreground hover:text-primary"
                    aria-label="Toggle done"
                  >
                    {t.done ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => goToEditTask(t.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p
                      className={cn(
                        "text-sm font-medium text-foreground hover:underline",
                        t.done && "line-through",
                      )}
                    >
                      {t.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {t.time && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {t.time}
                        </span>
                      )}
                      <Badge variant="outline" className={cn("text-[10px]", priorityStyles[t.priority].badge)}>
                        {priorityStyles[t.priority].label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{t.category}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePostToFacebook(t.id)}
                    disabled={postingId === t.id}
                    title={t.fbPostId ? "Update on Facebook" : "Post to Facebook"}
                    aria-label={t.fbPostId ? "Update on Facebook" : "Post to Facebook"}
                    className={cn(
                      "mt-0.5 shrink-0 rounded-md p-1.5 transition-colors disabled:opacity-50",
                      t.fbPostId
                        ? "text-[#1877F2] hover:bg-[#1877F2]/10"
                        : "text-muted-foreground hover:text-[#1877F2] hover:bg-[#1877F2]/10",
                    )}
                  >
                    <Facebook className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md",
            tone === "default" && "bg-muted text-foreground",
            tone === "success" && "bg-chart-2/10 text-chart-2",
            tone === "danger" && "bg-destructive/10 text-destructive",
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SheetStatusBadge({
  status,
  error,
}: {
  status: "idle" | "loading" | "synced" | "not-configured" | "error";
  error: string | null;
}) {
  if (status === "idle" || status === "not-configured") return null;
  const map = {
    loading: { label: "Syncing…", cls: "bg-muted text-muted-foreground" },
    synced: { label: "Sheet synced", cls: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
    error: { label: "Sheet error", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  } as const;
  const v = map[status as "loading" | "synced" | "error"];
  return (
    <span
      title={error ?? undefined}
      className={cn(
        "hidden md:inline-flex items-center rounded-md border border-transparent px-2 py-1 text-[10px] font-medium",
        v.cls,
      )}
    >
      {v.label}
    </span>
  );
}
