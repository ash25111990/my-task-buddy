import { useState, FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type TaskFormValues = {
  id?: string;
  title: string;
  date: string;
  time: string;
  priority: "low" | "medium" | "high";
  category: string;
  done: boolean;
  image_url?: string | null;
};

export function TaskForm({ initial }: { initial?: TaskFormValues }) {
  const navigate = useNavigate();
  const isEdit = Boolean(initial?.id);
  const [values, setValues] = useState<TaskFormValues>(
    initial ?? {
      title: "",
      date: new Date().toISOString().slice(0, 10),
      time: "",
      priority: "medium",
      category: "General",
      done: false,
      image_url: null,
    },
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) {
      toast.error("Not signed in");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${uid}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("task-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from("task-images").getPublicUrl(path);
    update("image_url", pub.publicUrl);
    setUploading(false);
    toast.success("Image uploaded");
  };

  const update = <K extends keyof TaskFormValues>(k: K, v: TaskFormValues[K]) =>
    setValues((p) => ({ ...p, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!values.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    const payload = {
      title: values.title.trim().slice(0, 200),
      date: values.date,
      time: values.time || null,
      priority: values.priority,
      category: values.category.trim().slice(0, 50) || "General",
      done: values.done,
    };
    let error;
    if (isEdit && values.id) {
      ({ error } = await supabase.from("tasks").update(payload).eq("id", values.id));
    } else {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) {
        setSaving(false);
        toast.error("Not signed in");
        return;
      }
      ({ error } = await supabase.from("tasks").insert({ ...payload, user_id: uid }));
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isEdit ? "Task updated" : "Task created");
    navigate({ to: "/" });
  };

  const onDelete = async () => {
    if (!values.id) return;
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", values.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Task deleted");
    navigate({ to: "/" });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          maxLength={200}
          placeholder="What needs to be done?"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={values.date}
            onChange={(e) => update("date", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="time">Time (optional)</Label>
          <Input
            id="time"
            type="time"
            value={values.time}
            onChange={(e) => update("time", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            value={values.priority}
            onValueChange={(v) => update("priority", v as TaskFormValues["priority"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={values.category}
            onChange={(e) => update("category", e.target.value)}
            maxLength={50}
            placeholder="Work, Personal, Health..."
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.done}
          onChange={(e) => update("done", e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Mark as completed
      </label>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate({ to: "/" })}
        >
          Cancel
        </Button>
        <div className="flex gap-2">
          {isEdit && (
            <Button type="button" variant="destructive" onClick={onDelete}>
              Delete
            </Button>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Update task" : "Create task"}
          </Button>
        </div>
      </div>
    </form>
  );
}
