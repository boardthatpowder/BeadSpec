import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { claimTask, commands, unwrap } from "../../ipc";
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
import { ImpactPanel } from "./ImpactPanel";
import { MismatchChips } from "./MismatchChips";
import { ReviewsSection } from "../reviews/ReviewsSection";
import { useFeatureFlag } from "../../contexts/SettingsContext";
import { useAppState } from "../../contexts/HashStateContext";
import { useTasks } from "../../hooks/useTasks";
import { findScopeChangeChild } from "../../lib/findScopeChangeChild";
import { formatAbsolute } from "../../lib/format/date";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Tabs } from "../ui/Tabs";
import { useToast } from "../ui/Toast";

type TabId = "details" | "dependencies" | "activity" | "impact";

interface TaskDetailPanelProps {
  taskId: string;
  paneId: string;
}

export function TaskDetailPanel({ taskId, paneId }: TaskDetailPanelProps) {
  const project = useActiveProject();
  const { innerSubTab, setInnerSubTab } = useWorkspaceStore();
  const { state } = useAppState();
  const { allTasks } = useTasks();

  // Per-tab inner sub-tab state (task 6.2): keyed by paneId:taskId.
  const activeTab: TabId = (innerSubTab[`${paneId}:${taskId}`] ??
    "details") as TabId;
  function setActiveTab(tab: TabId) {
    setInnerSubTab(paneId, taskId, tab);
  }

  useEffect(() => {
    if (state.impactSymbol && activeTab !== "impact") {
      setInnerSubTab(paneId, taskId, "impact");
    }
  }, [activeTab, paneId, setInnerSubTab, state.impactSymbol, taskId]);

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
    { id: "impact", label: "Impact" },
  ];
  const scopeChangeChild = findScopeChangeChild(
    task,
    allTasks,
    [...task.dependencies, ...task.dependents],
  );

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
                  <Icon name="GitBranch" size="sm" />
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
            <TaskHeaderActions task={task} project={project ?? ""} />
          </div>
        </div>

        <MismatchChips labels={task.labels ?? []} />

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
      <Tabs.Root
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabId)}
        className="flex flex-1 min-h-0 flex-col"
      >
        <Tabs.List className="flex-shrink-0 px-6">
          {tabs.map((tab) => (
            <Tabs.Trigger key={tab.id} value={tab.id} className="px-4 py-3 text-sm font-medium">
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Tab content */}
        <Tabs.Content value="details" className="flex-1 min-h-0 overflow-y-auto">
          <ErrorBoundary key="details">
            <DetailsTab
              task={task}
              project={project ?? ""}
              rufloAvailable={rufloAvailable}
              paneId={paneId}
              scopeChangeChild={scopeChangeChild}
            />
          </ErrorBoundary>
        </Tabs.Content>

        <Tabs.Content value="dependencies" className="flex-1 min-h-0 overflow-hidden">
          <ErrorBoundary key="dependencies">
            <DependenciesTab
              key={task.id}
              task={task}
              project={project ?? ""}
            />
          </ErrorBoundary>
        </Tabs.Content>

        <Tabs.Content value="activity" className="flex-1 min-h-0 overflow-y-auto">
          <ErrorBoundary key="activity">
            <div className="p-5 flex flex-col gap-4">
              <ActivityTimeline
                taskId={task.id}
                project={project ?? ""}
                activeTab="activity"
              />
              {rufloAvailable && <ReviewsSection project={project ?? ""} labels={task.labels ?? []} />}
              <GitHistoryPanel
                gitRefs={gitRefsData}
                isLoading={gitRefsLoading}
              />
            </div>
          </ErrorBoundary>
        </Tabs.Content>

        <Tabs.Content value="impact" className="flex-1 min-h-0 overflow-y-auto">
          <ErrorBoundary key="impact">
            <ImpactPanel task={task} project={project ?? ""} paneId={paneId} />
          </ErrorBoundary>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function TaskHeaderActions({ task, project }: { task: TaskDetail; project: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const taskKey = ["task", project, task.id] as const;

  const rollback = (previous: TaskDetail | undefined) => {
    if (previous) queryClient.setQueryData(taskKey, previous);
  };

  const invalidateTask = () => {
    queryClient.invalidateQueries({ queryKey: taskKey });
    queryClient.invalidateQueries({ queryKey: ["tasks", project] });
  };

  const claim = useMutation({
    mutationFn: () => claimTask(project, task.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: taskKey });
      const previous = queryClient.getQueryData<TaskDetail>(taskKey);
      queryClient.setQueryData<TaskDetail>(taskKey, (old) =>
        old ? { ...old, status: 'in_progress' } : old,
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      rollback(context?.previous);
      toast(`Claim failed: ${messageFromError(error, "Could not claim task.")}`);
    },
    onSettled: invalidateTask,
  });

  const close = useMutation({
    mutationFn: () => unwrap(commands.changeTaskStatus(project, task.id, 'closed', false)),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: taskKey });
      const previous = queryClient.getQueryData<TaskDetail>(taskKey);
      queryClient.setQueryData<TaskDetail>(taskKey, (old) =>
        old ? { ...old, status: 'closed' } : old,
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      rollback(context?.previous);
      toast(`Close failed: ${messageFromError(error, "Could not close task.")}`);
    },
    onSettled: invalidateTask,
  });

  if (!project || task.status === "closed") return null;

  return (
    <>
      {task.status === "open" && !task.assignee && (
        <Button
          variant="primary"
          size="xs"
          onClick={() => claim.mutate()}
          disabled={claim.isPending}
        >
          Claim
        </Button>
      )}
      <Button
        variant="secondary"
        size="xs"
        onClick={() => close.mutate()}
        disabled={close.isPending}
      >
        Close
      </Button>
    </>
  );
}

function DetailsTab({
  task,
  project,
  rufloAvailable,
  paneId,
  scopeChangeChild,
}: {
  task: TaskDetail;
  project: string;
  rufloAvailable: boolean;
  paneId: string;
  scopeChangeChild: { id: string; title: string } | null;
}) {
  const openspecEnabled = useFeatureFlag("openspec");
  const rufloEnabled = useFeatureFlag("ruflo");
  const setInnerSubTab = useWorkspaceStore(s => s.setInnerSubTab);
  const { setState } = useAppState();

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
          onOpenImpact={(symbol) => {
            setInnerSubTab(paneId, task.id, "impact")
            setState({ impactSymbol: symbol })
          }}
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
          taskLabels={task.labels ?? []}
          taskNotes={task.description}
          scopeChangeChild={scopeChangeChild}
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
  return formatAbsolute(iso) || iso;
}

function messageFromError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}
