import Link from "next/link";

export type TaskView = "list" | "kanban" | "gantt" | "epics" | "sprints" | "milestones";

const TABS: { key: TaskView; label: string; segment: string }[] = [
  { key: "list", label: "Danh sách", segment: "tasks" },
  { key: "kanban", label: "Kanban", segment: "kanban" },
  { key: "gantt", label: "Gantt", segment: "gantt" },
  { key: "epics", label: "Epic", segment: "epics" },
  { key: "sprints", label: "Sprint", segment: "sprints" },
  { key: "milestones", label: "Milestone", segment: "milestones" },
];

/** Segmented view switcher for the project task workspace. Rendered at the top of
 * the tasks / kanban / gantt / epics / sprints / milestones pages so those views
 * are modes within one workspace instead of separate sidebar entries. */
export function TaskViewTabs({ projectId, active }: { projectId: string; active: TaskView }) {
  return (
    <nav className="-mx-1 flex flex-wrap gap-1 overflow-x-auto px-1">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={`/projects/${projectId}/${t.segment}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
