import { useQuery } from "@tanstack/react-query";
import { commands, unwrap } from "../../ipc";
import type { TaskDetail, GitRefs } from "../../bindings";
import { useActiveProject } from "../../hooks/useProject";
import { useWorkspaceStore } from "../../stores/workspace";
import { DetailPanelSkeleton } from "../ui/Skeleton";
import { InlineTitle } from "./InlineTitle";
import { StatusDropdown } from "./StatusDropdown";
import { PrioritySelector } from "./PrioritySelector";
import { AssigneePicker } from "./AssigneePicker";
import { LabelManager } from "./LabelManager";
import { OutsideFilterIndicator } from "./OutsideFilterIndicator";
import { DependencyGraphTab } from "./DependencyGraphTab";
import { DescriptionEditor } from "./DescriptionEditor";
import { CommentsSection } from "./CommentsSection";
import { ActivityTimeline } from "./ActivityTimeline";
import { BreadcrumbBar } from "./BreadcrumbBar";
import { useBackNavigation } from "../../hooks/useBackNavigation";
import { ErrorBoundary } from "../ErrorBoundary";
import { RufloMemoryPanel } from "./RufloMemoryPanel";
import { GitHistoryPanel } from "./GitHistoryPanel";
import { OpenSpecPanel } from "./OpenSpecPanel";
import { HumanQueueToggle } from "./HumanQueueToggle";
import { useFeatureFlag } from "../../contexts/SettingsContext";

type TabId = "details" | "dependencies" | "activity";

interface TaskDetailPanelProps {
  taskId: string;
  paneId: string;
}

export function TaskDetailPanel({ taskId, paneId }: TaskDetailPanelProps) {
  const project = useActiveProject();
  const { innerSubTab, setInnerSubTab } = useWorkspaceStore();

  // Per-tab inner sub-tab state (task 6.2): keyed by paneId:taskId.
  const activeTab: TabId = (innerSubTab[`${paneId}:${taskId}`] ??
    "details") as TabId;
  function setActiveTab(tab: TabId) {
    setInnerSubTab(paneId, taskId, tab);
  }

  // Register Backspace / Alt+Left shortcuts for dep-graph back-navigation
  useBackNavigation();

  const {
    data: task,
    isLoading,
    error,
  } = useQuery<TaskDetail>({
    queryKey: ["task", project, taskId],
    queryFn: () => unwrap(commands.getTask(project!, taskId!)),
    enabled: !!project && !!taskId,
    staleTime: 30_000,
  });

  // Check if ruflo is available once per project (attempt --version probe)
  const { data: rufloAvailable = false } = useQuery<boolean>({
    queryKey: ["rufloAvailable", project],
    queryFn: async () => {
      try {
        await unwrap(commands.rufloVersionProbe());
        return true;
      } catch {
        return false;
      }
    },
    enabled: !!project,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Git refs — pre-fetched so the branch badge shows before activity tab is opened
  const { data: gitRefsData, isLoading: gitRefsLoading } = useQuery<GitRefs>({
    queryKey: ["gitRefs", project, taskId],
    queryFn: () => unwrap(commands.getGitRefsForIssue(project!, taskId!)),
    enabled: !!project && !!taskId,
    staleTime: 60_000,
  });

  if (isLoading) return <DetailPanelSkeleton />;

  if (error || !task) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-400 text-sm">
          Failed to load task: {String(error)}
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "details", label: "Details" },
    {
      id: "dependencies",
      label: `Dependencies (${task.dependencies.length + task.dependents.length})`,
    },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <BreadcrumbBar />
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-neutral-800">
        <div className="flex items-start justify-between gap-3 mb-2">
          <InlineTitle task={task} project={project ?? ""} />
          <div className="flex items-center gap-2 flex-shrink-0 mt-1">
            {/* Branch badge — shown when git refs are loaded and a branch references this task */}
            {!gitRefsLoading &&
              gitRefsData &&
              gitRefsData.branches.length > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-400 border border-neutral-700"
                  title={gitRefsData.branches.join(", ")}
                >
                  <svg
                    className="w-2.5 h-2.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 3v12m0 0a3 3 0 100 6 3 3 0 000-6zm0 0h6a3 3 0 100-6H6"
                    />
                  </svg>
                  {gitRefsData.branches[0]}
                  {gitRefsData.branches.length > 1 && (
                    <span className="text-neutral-600">
                      +{gitRefsData.branches.length - 1}
                    </span>
                  )}
                </span>
              )}
            <span className="text-[11px] text-neutral-600 font-mono select-all">
              {task.id}
            </span>
          </div>
        </div>

        {/* Compact metadata strip: status · priority · assignee · type */}
        <div className="flex items-center gap-1.5 flex-wrap mt-3">
          <StatusDropdown task={task} project={project ?? ""} />
          <span className="text-neutral-700 text-xs">·</span>
          <PrioritySelector task={task} project={project ?? ""} />
          <span className="text-neutral-700 text-xs">·</span>
          <AssigneePicker task={task} project={project ?? ""} />
          {task.task_type && (
            <>
              <span className="text-neutral-700 text-xs">·</span>
              <span className="text-xs text-neutral-500 capitalize">
                {task.task_type}
              </span>
            </>
          )}
          <span className="text-neutral-700 text-xs">·</span>
          <HumanQueueToggle task={task} project={project ?? ""} />
        </div>

        {/* Label chips with inline management */}
        <div className="mt-2.5">
          <LabelManager task={task} project={project ?? ""} />
        </div>
      </div>

      <OutsideFilterIndicator visible={false} />

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-neutral-800 px-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-neutral-500 hover:text-neutral-300",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        className={`flex-1 min-h-0 relative ${activeTab === "dependencies" ? "overflow-hidden" : "overflow-y-auto"}`}
      >
        <ErrorBoundary key={activeTab}>
          {activeTab === "details" && (
            <DetailsTab
              task={task}
              project={project ?? ""}
              rufloAvailable={rufloAvailable}
              paneId={paneId}
            />
          )}
          {activeTab === "dependencies" && (
            <DependenciesTab
              key={task.id}
              task={task}
              project={project ?? ""}
            />
          )}
          {activeTab === "activity" && (
            <div className="p-5 flex flex-col gap-4">
              <ActivityTimeline
                taskId={task.id}
                project={project ?? ""}
                activeTab={activeTab}
              />
              <GitHistoryPanel
                gitRefs={gitRefsData}
                isLoading={gitRefsLoading}
              />
            </div>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}

function DetailsTab({
  task,
  project,
  rufloAvailable,
  paneId,
}: {
  task: TaskDetail;
  project: string;
  rufloAvailable: boolean;
  paneId: string;
}) {
  const openspecEnabled = useFeatureFlag("openspec");
  const rufloEnabled = useFeatureFlag("ruflo");

  // Extract openspec:<change-name> label (case-insensitive prefix check)
  const openspecChangeName: string | null = (() => {
    const label = (task.labels ?? []).find((l) =>
      l.toLowerCase().startsWith("openspec:"),
    );
    if (!label) return null;
    const idx = label.indexOf(":");
    return label.slice(idx + 1) || null;
  })();

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Description card */}
      <div className="rounded-lg border border-neutral-800/60 bg-neutral-900/30 p-4">
        <div className="text-xs font-medium text-neutral-400 mb-3">
          Description
        </div>
        <DescriptionEditor
          taskId={task.id}
          project={project}
          initialContent={task.description}
        />
      </div>

      {/* Details card */}
      <div className="rounded-lg border border-neutral-800/60 bg-neutral-900/30 px-4 py-3">
        <div className="text-xs font-medium text-neutral-400 mb-2">Details</div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span>Created {formatDate(task.created_at)}</span>
          <span className="text-neutral-700">·</span>
          <span>Updated {formatDate(task.updated_at)}</span>
        </div>
      </div>

      {/* OpenSpec panel — shown for openspec:* labelled tasks when OpenSpec feature is enabled */}
      {openspecEnabled && openspecChangeName && (
        <OpenSpecPanel
          changeName={openspecChangeName}
          containerMode="section"
          projectRoot={project}
          taskTitle={task.title}
          taskStatus={task.status}
          paneId={paneId}
          taskId={task.id}
        />
      )}

      {/* Ruflo memory panel — shown when Ruflo feature is enabled and ruflo is on PATH */}
      {rufloEnabled && rufloAvailable && (
        <RufloMemoryPanel
          taskId={task.id}
          title={task.title}
          labels={task.labels ?? []}
        />
      )}

      {/* Comments card */}
      <div className="rounded-lg border border-neutral-800/60 bg-neutral-900/30 p-4">
        <CommentsSection taskId={task.id} project={project} />
      </div>
    </div>
  );
}

function DependenciesTab({
  task,
  project,
}: {
  task: TaskDetail;
  project: string;
}) {
  return <DependencyGraphTab task={task} project={project} />;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
