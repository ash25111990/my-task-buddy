import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { TaskForm } from "@/components/TaskForm";

export const Route = createFileRoute("/tasks/new")({
  head: () => ({
    meta: [
      { title: "New Task — Calendar" },
      { name: "description", content: "Create a new calendar task." },
    ],
  }),
  component: NewTaskPage,
});

function NewTaskPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-4 py-8 md:py-12">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to calendar
        </Link>
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">New task</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Add a task to your calendar.
        </p>
        <div className="rounded-xl border border-border bg-card p-6">
          <TaskForm />
        </div>
      </div>
    </div>
  );
}
