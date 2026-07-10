"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, GitCompare, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createAiSubtasksAction,
  previewAiSubtasksAction,
  saveAiSubtaskDraftAction,
  type AiSubtaskPreviewProposal,
  type AiSubtaskPreviewState,
} from "@/lib/actions/tasks";

export function AutoSubtaskDialog({
  projectId,
  taskId,
  parentEstimateHours,
}: {
  projectId: string;
  taskId: string;
  parentEstimateHours: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<AiSubtaskPreviewState>({});
  const [comparison, setComparison] = useState<AiSubtaskPreviewState | null>(null);
  const [proposals, setProposals] = useState<AiSubtaskPreviewProposal[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [previewPending, startPreviewTransition] = useTransition();
  const [createPending, startCreateTransition] = useTransition();
  const [savePending, startSaveTransition] = useTransition();

  const selectedProposals = useMemo(
    () => proposals.filter((proposal) => !proposal.duplicate && selectedKeys.has(proposal.sourceKey)),
    [proposals, selectedKeys],
  );
  const totalEstimate = selectedProposals.reduce(
    (sum, proposal) => sum + (Number.isFinite(proposal.devEstimateHours) ? proposal.devEstimateHours : 0),
    0,
  );
  const mandatoryRefs = useMemo(
    () => (preview.sourceReferences ?? []).filter((ref) => ref.mandatory).map((ref) => ref.id),
    [preview.sourceReferences],
  );
  const coveredRefs = useMemo(
    () => new Set(selectedProposals.flatMap((proposal) => proposal.coveredSourceRefs)),
    [selectedProposals],
  );
  const missingRefs = mandatoryRefs.filter((ref) => !coveredRefs.has(ref));
  const effectiveParentEstimate = preview.parentEstimateHours ?? parentEstimateHours;
  const diffs = useMemo(
    () => compareProposals(comparison?.proposals ?? [], proposals),
    [comparison, proposals],
  );

  function applyPreview(result: AiSubtaskPreviewState) {
    setPreview(result);
    setProposals(result.proposals ?? []);
    setSelectedKeys(
      new Set((result.proposals ?? []).filter((proposal) => !proposal.duplicate).map((proposal) => proposal.sourceKey)),
    );
    setComparison(null);
    if (result.error) toast.error(result.error);
    else if (result.success) toast.success(result.success);
  }

  function loadPreview(options: { forceNew?: boolean; generationId?: string } = {}) {
    startPreviewTransition(async () => {
      applyPreview(await previewAiSubtasksAction(projectId, taskId, options));
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;
    setPreview({});
    setProposals([]);
    setSelectedKeys(new Set());
    setComparison(null);
    loadPreview();
  }

  function handleCreate() {
    if (!preview.generation) return;
    startCreateTransition(async () => {
      try {
        const result = await createAiSubtasksAction(
          projectId,
          taskId,
          preview.generation!.id,
          selectedProposals,
        );
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.success) toast.success(result.success);
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể tạo sub-task. Vui lòng thử lại.");
      }
    });
  }

  function loadComparison(generationId: string) {
    if (!generationId) return setComparison(null);
    startPreviewTransition(async () => {
      const result = await previewAiSubtasksAction(projectId, taskId, { generationId });
      if (result.error) toast.error(result.error);
      else setComparison(result);
    });
  }

  function saveDraft() {
    if (!preview.generation) return;
    startSaveTransition(async () => {
      const result = await saveAiSubtaskDraftAction(
        projectId,
        taskId,
        preview.generation!.id,
        proposals,
      );
      if (result.error) toast.error(result.error);
      else if (result.success) toast.success(result.success);
    });
  }

  function updateProposal(
    sourceKey: string,
    field: "title" | "description" | "acceptanceCriteria" | "devEstimateHours",
    value: string,
  ) {
    setProposals((current) =>
      current.map((proposal) =>
        proposal.sourceKey === sourceKey
          ? { ...proposal, [field]: field === "devEstimateHours" ? Number(value) : value }
          : proposal,
      ),
    );
  }

  function toggleSourceRef(sourceKey: string, sourceRef: string, checked: boolean) {
    setProposals((current) =>
      current.map((proposal) => {
        if (proposal.sourceKey !== sourceKey) return proposal;
        const next = new Set(proposal.coveredSourceRefs);
        if (checked) next.add(sourceRef);
        else next.delete(sourceRef);
        return { ...proposal, coveredSourceRefs: [...next] };
      }),
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Sparkles className="size-3.5" />
          Tự động tạo sub-task
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[94vh] flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Tự động phân rã sub-task</DialogTitle>
          <DialogDescription>
            Cùng nội dung task cha sẽ tái sử dụng phiên bản gần nhất. Mỗi sub-task tối đa 8 giờ Dev.
          </DialogDescription>
        </DialogHeader>

        {preview.generation ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[10px] border bg-muted/30 p-3 text-xs">
            <strong>Phiên bản {preview.generation.versionNo}</strong>
            <span>{preview.generation.createdByName}</span>
            <span>{new Date(preview.generation.createdAt).toLocaleString("vi-VN")}</span>
            <span>{preview.generation.model}</span>
            <span>{preview.contextCurrent ? "Context hiện tại" : "Context đã thay đổi"}</span>
            <span>{preview.generation.status === "ACCEPTED" ? "Đã tạo task" : "Bản nháp"}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <SummaryItem label="Đề xuất" value={String(proposals.length)} />
          <SummaryItem label="Đã chọn" value={String(selectedProposals.length)} />
          <SummaryItem label="Tổng Dev estimate" value={`${totalEstimate}h`} />
          <SummaryItem label="Coverage còn thiếu" value={String(missingRefs.length)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={previewPending} onClick={() => loadPreview({ forceNew: true })}>
            <RefreshCw className="size-3.5" />
            Tạo phiên bản mới
          </Button>
          {(preview.generations?.length ?? 0) > 1 ? (
            <>
              <select
                className="h-9 rounded-[10px] border bg-background px-3 text-sm"
                value={preview.generation?.id ?? ""}
                onChange={(event) => loadPreview({ generationId: event.target.value })}
              >
                {preview.generations?.map((generation) => (
                  <option key={generation.id} value={generation.id}>
                    Phiên bản {generation.versionNo} · {generation.createdByName}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <GitCompare className="size-4" />
                <select
                  aria-label="Phiên bản so sánh"
                  className="h-9 rounded-[10px] border bg-background px-3 text-sm"
                  defaultValue=""
                  onChange={(event) => loadComparison(event.target.value)}
                >
                  <option value="">So sánh với...</option>
                  {preview.generations
                    ?.filter((generation) => generation.id !== preview.generation?.id)
                    .map((generation) => (
                      <option key={generation.id} value={generation.id}>
                        Phiên bản {generation.versionNo}
                      </option>
                    ))}
                </select>
              </div>
            </>
          ) : null}
        </div>

        {comparison ? (
          <VersionDiff
            diffs={diffs}
            versionNo={comparison.generation?.versionNo}
            before={comparison.proposals ?? []}
            after={proposals}
          />
        ) : null}

        {missingRefs.length > 0 ? (
          <Warning>
            Chưa bao phủ: {missingRefs.join(", ")}. Hãy chọn source mapping phù hợp trước khi tạo.
          </Warning>
        ) : effectiveParentEstimate > 0 && totalEstimate > effectiveParentEstimate ? (
          <Warning>
            Tổng estimate {totalEstimate}h vượt estimate task cha {effectiveParentEstimate}h.
          </Warning>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {proposals.length > 0 ? (
            <div className="space-y-3">
              {proposals.map((proposal, index) => (
                <div key={proposal.sourceKey} className="rounded-[14px] border p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`subtask-${proposal.sourceKey}`}
                      className="mt-1"
                      checked={selectedKeys.has(proposal.sourceKey)}
                      disabled={proposal.duplicate}
                      onCheckedChange={(checked) =>
                        setSelectedKeys((current) => {
                          const next = new Set(current);
                          if (checked === true) next.add(proposal.sourceKey);
                          else next.delete(proposal.sourceKey);
                          return next;
                        })
                      }
                    />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap justify-between gap-2 text-xs">
                        <strong>Sub-task {index + 1}</strong>
                        <span>{proposal.duplicate ? "Đã tồn tại" : `Tin cậy ${Math.round(proposal.confidence * 100)}%`}</span>
                      </div>
                      <Field label="Tiêu đề">
                        <Input value={proposal.title} disabled={proposal.duplicate} onChange={(event) => updateProposal(proposal.sourceKey, "title", event.target.value)} />
                      </Field>
                      <Field label="Mô tả">
                        <Textarea rows={6} value={proposal.description} disabled={proposal.duplicate} onChange={(event) => updateProposal(proposal.sourceKey, "description", event.target.value)} />
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                        <Field label="Tiêu chí nghiệm thu">
                          <Textarea rows={4} value={proposal.acceptanceCriteria} disabled={proposal.duplicate} onChange={(event) => updateProposal(proposal.sourceKey, "acceptanceCriteria", event.target.value)} />
                        </Field>
                        <Field label="Dev estimate (giờ)">
                          <Input type="number" min="0.5" max="8" step="0.5" value={proposal.devEstimateHours} disabled={proposal.duplicate} onChange={(event) => updateProposal(proposal.sourceKey, "devEstimateHours", event.target.value)} />
                        </Field>
                      </div>
                      <details className="rounded-[10px] border p-2 text-xs">
                        <summary className="cursor-pointer font-medium">Nguồn truy vết ({proposal.coveredSourceRefs.length})</summary>
                        <p className="mt-2 text-muted-foreground">{proposal.sourceEvidence}</p>
                        <div className="mt-2 grid gap-1 sm:grid-cols-2">
                          {preview.sourceReferences?.map((ref) => (
                            <label key={ref.id} className="flex items-start gap-2 rounded-md p-1 hover:bg-muted/40">
                              <Checkbox checked={proposal.coveredSourceRefs.includes(ref.id)} disabled={proposal.duplicate} onCheckedChange={(checked) => toggleSourceRef(proposal.sourceKey, ref.id, checked === true)} />
                              <span><strong>{ref.id}</strong> · {ref.text}</span>
                            </label>
                          ))}
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-48 items-center justify-center rounded-[14px] border border-dashed p-6 text-center text-sm text-muted-foreground">
              {previewPending ? "AI đang phân tích nội dung task..." : preview.success || preview.error || "Đang tải phiên bản gần nhất..."}
            </div>
          )}
        </div>

        <DialogFooter>
          {preview.generation?.status === "DRAFT" ? (
            <Button type="button" variant="outline" disabled={savePending || previewPending} onClick={saveDraft}>
              {savePending ? "Đang lưu..." : "Lưu bản nháp"}
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={
              previewPending ||
              createPending ||
              !preview.generation ||
              selectedProposals.length === 0 ||
              missingRefs.length > 0 ||
              selectedProposals.some((proposal) => !Number.isFinite(proposal.devEstimateHours) || proposal.devEstimateHours < 0.5 || proposal.devEstimateHours > 8)
            }
            onClick={handleCreate}
          >
            {createPending ? "Đang tạo..." : `Tạo ${selectedProposals.length} sub-task`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function compareProposals(before: AiSubtaskPreviewProposal[], after: AiSubtaskPreviewProposal[]) {
  const beforeMap = new Map(before.map((proposal) => [proposal.sourceKey, proposal]));
  const afterMap = new Map(after.map((proposal) => [proposal.sourceKey, proposal]));
  return [...new Set([...beforeMap.keys(), ...afterMap.keys()])].map((sourceKey) => {
    const left = beforeMap.get(sourceKey);
    const right = afterMap.get(sourceKey);
    if (!left) return { sourceKey, label: right?.title ?? sourceKey, type: "Thêm", changes: ["Task mới"] };
    if (!right) return { sourceKey, label: left.title, type: "Bỏ", changes: ["Task bị loại"] };
    const changes: string[] = [];
    if (left.title !== right.title) changes.push("Tiêu đề");
    if (left.description !== right.description) changes.push("Mô tả");
    if (left.acceptanceCriteria !== right.acceptanceCriteria) changes.push("Tiêu chí nghiệm thu");
    if (left.devEstimateHours !== right.devEstimateHours) {
      changes.push(`Estimate ${left.devEstimateHours}h → ${right.devEstimateHours}h`);
    }
    if (left.coveredSourceRefs.join("|") !== right.coveredSourceRefs.join("|")) changes.push("Source coverage");
    return { sourceKey, label: right.title, type: changes.length > 0 ? "Thay đổi" : "Không đổi", changes };
  });
}

function VersionDiff({
  diffs,
  versionNo,
  before,
  after,
}: {
  diffs: ReturnType<typeof compareProposals>;
  versionNo?: number;
  before: AiSubtaskPreviewProposal[];
  after: AiSubtaskPreviewProposal[];
}) {
  const beforeHours = before.reduce((sum, proposal) => sum + proposal.devEstimateHours, 0);
  const afterHours = after.reduce((sum, proposal) => sum + proposal.devEstimateHours, 0);
  const beforeCoverage = new Set(before.flatMap((proposal) => proposal.coveredSourceRefs)).size;
  const afterCoverage = new Set(after.flatMap((proposal) => proposal.coveredSourceRefs)).size;
  return (
    <div className="max-h-32 overflow-y-auto rounded-[10px] border p-3 text-xs">
      <p className="mb-2 font-semibold">So với phiên bản {versionNo}</p>
      <p className="mb-2 text-muted-foreground">
        Tổng estimate {beforeHours}h → {afterHours}h · Coverage {beforeCoverage} → {afterCoverage} nguồn
      </p>
      <div className="space-y-1">
        {diffs.map((diff) => (
          <p key={diff.sourceKey}>
            <strong>{diff.type}</strong> · {diff.label}
            {diff.changes.length > 0 ? ` · ${diff.changes.join(", ")}` : ""}
          </p>
        ))}
      </div>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start gap-2 rounded-[10px] border bg-muted/40 p-3 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>{children}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[10px] border bg-muted/30 p-2.5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}
