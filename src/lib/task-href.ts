/** Builds a task link. The task segment prefers the business task code and
 * falls back to the raw database id for tasks that do not have a code yet. */
export function taskHref(projectId: string, moduleId: string | null, taskId: string, taskCode?: string | null): string {
  const taskSegment = taskCode || taskId;
  if (moduleId) {
    return `/projects/${projectId}/modules/${moduleId}/tasks/${taskSegment}`;
  }
  return `/projects/${projectId}/tasks/${taskSegment}`;
}

/** Link to a document related to a task (review requests). Documents always live
 * under a module, so this requires a moduleId. */
export function taskDocumentHref(
  projectId: string,
  moduleId: string | null,
  documentId: string,
): string {
  if (moduleId) {
    return `/projects/${projectId}/modules/${moduleId}/documents/${documentId}`;
  }
  // Fallback: no module context — send to the project overview.
  return `/projects/${projectId}/overview`;
}
