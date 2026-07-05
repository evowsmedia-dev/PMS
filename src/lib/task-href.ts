/** Builds the canonical link to a task. Tasks created at the project level have
 * no module, so they live under /projects/[id]/tasks/[taskId]; module-scoped
 * tasks keep their legacy /projects/[id]/modules/[moduleId]/tasks/[taskId] URL. */
export function taskHref(projectId: string, moduleId: string | null, taskId: string): string {
  if (moduleId) {
    return `/projects/${projectId}/modules/${moduleId}/tasks/${taskId}`;
  }
  return `/projects/${projectId}/tasks/${taskId}`;
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
