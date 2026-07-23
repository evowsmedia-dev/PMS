"use client";

import { useState } from "react";
import { TaskProjectCreateForm } from "@/components/task-project-create-form";
import { BugCreateForm } from "@/components/qa-forms";

interface Option {
  id: string;
  label: string;
}

/** Create entry point for the task workspace: a Task | Bug toggle that renders the
 * full task form or the bug form. Bug creation lives here instead of a separate
 * sidebar page. */
export function CreateTaskOrBug({
  projectId,
  members,
  epics,
  sprints,
  milestones,
  tasks,
  documents = [],
  defaultParentTaskId,
  cancelHref,
}: {
  projectId: string;
  members: { userId: string; fullName: string }[];
  epics: Option[];
  sprints: Option[];
  milestones: Option[];
  tasks: Option[];
  documents?: Option[];
  defaultParentTaskId?: string;
  cancelHref?: string;
}) {
  const [mode, setMode] = useState<"task" | "bug">("task");

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md border p-0.5">
        <button
          type="button"
          onClick={() => setMode("task")}
          className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "task" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          Task
        </button>
        <button
          type="button"
          onClick={() => setMode("bug")}
          className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "bug" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          Bug
        </button>
      </div>

      {mode === "task" ? (
        <TaskProjectCreateForm
          projectId={projectId}
          members={members}
          epics={epics}
          sprints={sprints}
          milestones={milestones}
          tasks={tasks}
          documents={documents}
          defaultParentTaskId={defaultParentTaskId}
          cancelHref={cancelHref}
        />
      ) : (
        <BugCreateForm projectId={projectId} members={members} tasks={tasks} defaultTaskId={defaultParentTaskId} />
      )}
    </div>
  );
}
