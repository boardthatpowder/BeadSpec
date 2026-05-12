import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";

interface TasksChangedPayload {
  project: string;
  task_ids: string[];
}

interface TaskListChangedPayload {
  project: string;
}

/**
 * Listens for Dolt real-time events from the Rust poller and invalidates
 * TanStack Query cache entries accordingly.
 *
 * Call once at the app root — inside the QueryClientProvider.
 */
export function useTauriSync(activeProject?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Listen for targeted task changes — invalidate only those task queries
    const unlistenChanged = listen<TasksChangedPayload>(
      "tasks_changed",
      (event) => {
        const { project, task_ids } = event.payload;
        if (activeProject && project !== activeProject) return;

        // Invalidate each changed task's detail query
        task_ids.forEach((id) => {
          queryClient.invalidateQueries({ queryKey: ["task", project, id] });
        });

        // Also invalidate the list (changed tasks affect filters/KPIs)
        queryClient.invalidateQueries({
          queryKey: ["tasks", project],
          exact: false,
        });
      },
    );

    // Listen for full list refresh (structural changes)
    const unlistenListChanged = listen<TaskListChangedPayload>(
      "task_list_changed",
      (event) => {
        const { project } = event.payload;
        if (activeProject && project !== activeProject) return;

        queryClient.invalidateQueries({
          queryKey: ["tasks", project],
          exact: false,
        });
      },
    );

    // Listen for bd not found startup event
    const unlistenBdNotFound = listen("bd_not_found", () => {
      console.warn("[BeadSpec] bd CLI not found — write operations will fail");
      // The UI will show this via the bd_not_found event handler (added in 9.x)
    });

    return () => {
      unlistenChanged.then((fn) => fn());
      unlistenListChanged.then((fn) => fn());
      unlistenBdNotFound.then((fn) => fn());
    };
  }, [queryClient, activeProject]);
}
