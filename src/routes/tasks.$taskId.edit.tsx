import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { TaskForm, TaskFormValues } from "@/components/TaskForm";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/tasks/$taskId/edit")({
  head: () => ({
    meta: [
      { title: "Edit Task — Calendar" },
      { name: "description", content: "Edit an existing calendar task." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <EditTaskPage />
    </RequireAuth>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="min-h-screen bg-background p-8">
        <p className="text-destructive">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-4 underline"
        >
          Retry
        </button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background p-8">
      <p>Task not found.</p>
      <Link to="/" className="mt-4 inline-block underline">
        Back to calendar
      </Link>
    </div>
  ),
});

function EditTaskPage() {
  const { taskId } = Route.useParams();
  const [initial, setInitial] = useState<TaskFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
          return;
        }
        if (!data) {
          setError("Task not found");
          return;
        }
        setInitial({
          id: data.id,
          title: data.title,
          date: data.date,
          time: data.time ?? "",
          priority: data.priority as "low" | "medium" | "high",
          category: data.category,
          done: data.done,
          image_url: data.image_url ?? null,
        });
      });
  }, [taskId]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-4 py-8 md:py-12">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to calendar
        </Link>
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Edit task</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Update or delete this task.
        </p>
        <div className="rounded-xl border border-border bg-card p-6">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && !initial && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
          {initial && <TaskForm initial={initial} />}
        </div>
      </div>
    </div>
  );
}
