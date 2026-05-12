import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, unwrap } from "../../ipc";
import { IconButton } from "../ui/IconButton";
import { useActiveProject } from "../../hooks/useProject";
import { useToast } from "../ui/Toast";

interface QuickCreateState {
  title: string;
  priority: number;
}

export function TrayPopover() {
  const [open, setOpen] = useState(false);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [form, setForm] = useState<QuickCreateState>({
    title: "",
    priority: 2,
  });
  const [creating, setCreating] = useState(false);
  const project = useActiveProject();
  const { toast } = useToast();

  // Listen for tray open event from Rust
  useEffect(() => {
    const unlisten = listen("tray_open_popover", () => setOpen((o) => !o));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Task count shown when available; get_open_task_count not yet implemented
  useEffect(() => {
    if (!open || !project) return;
    setOpenCount(null);
  }, [open, project]);

  const createTask = async () => {
    if (!form.title.trim() || !project) return;
    setCreating(true);
    try {
      const result = await unwrap(
        commands.createTask(
          project,
          form.title.trim(),
          null,
          form.priority,
          null,
        ),
      );
      // Extract task ID from output
      const idMatch = result.output.match(/([A-Z]+-[a-z0-9]+)/);
      const taskId = idMatch?.[1] ?? "created";
      toast(`Task ${taskId} created`, { duration: 3000 });
      setForm({ title: "", priority: 2 });
    } catch (e) {
      toast(`Failed to create task: ${e}`);
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-16 right-4 z-50 w-72 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-neutral-200">Beads</span>
        <IconButton
          label="Close"
          onClick={() => setOpen(false)}
          className="text-neutral-500 hover:text-neutral-300 text-xs"
        >
          ✕
        </IconButton>
      </div>

      {openCount !== null && (
        <div className="mb-3 text-sm text-neutral-400">
          <span className="text-white font-semibold">{openCount}</span> open
          tasks
        </div>
      )}

      {/* Quick create */}
      <div className="mb-3">
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && createTask()}
          placeholder="Quick create task…"
          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-blue-500 mb-2"
        />
        <div className="flex items-center gap-2">
          <select
            value={form.priority}
            onChange={(e) =>
              setForm((f) => ({ ...f, priority: Number(e.target.value) }))
            }
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-300 outline-none"
          >
            <option value={1}>P1 Critical</option>
            <option value={2}>P2 High</option>
            <option value={3}>P3 Medium</option>
            <option value={4}>P4 Low</option>
          </select>
          <button
            onClick={createTask}
            disabled={creating || !form.title.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs py-1.5 rounded-lg transition-colors"
          >
            {creating ? "…" : "Create"}
          </button>
        </div>
      </div>

      <button
        onClick={() => {
          commands.focusMainWindow();
          setOpen(false);
        }}
        className="w-full text-center text-xs text-blue-400 hover:text-blue-300 transition-colors py-1"
      >
        Open BeadSpec →
      </button>
    </div>
  );
}
