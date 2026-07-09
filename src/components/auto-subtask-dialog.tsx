"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
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
  type AiSubtaskPreviewProposal,
  type AiSubtaskPreviewState,
  type CreateAiSubtasksState,
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
  const [proposals, setProposals] = useState<AiSubtaskPreviewProposal[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [previewPending, startPreviewTransition] = useTransition();
  const [createPending, startCreateTransition] = useTransition();

  const selectedProposals = useMemo(
    () =>
      proposals.filter(
        (proposal) => !proposal.duplicate && selectedKeys.has(proposal.sourceKey),
      ),
    [proposals, selectedKeys],
  );
  const totalEstimate = selectedProposals.reduce(
    (sum, proposal) => sum + (Number.isFinite(proposal.devEstimateHours) ? proposal.devEstimateHours : 0),
    0,
  );
  const effectiveParentEstimate = preview.parentEstimateHours ?? parentEstimateHours;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;
    setPreview({});
    setProposals([]);
    setSelectedKeys(new Set());
  }

  function handlePreview() {
    startPreviewTransition(async () => {
      const result = await previewAiSubtasksAction(projectId, taskId);
      setPreview(result);
      setProposals(result.proposals ?? []);
      setSelectedKeys(
        new Set(
          (result.proposals ?? [])
            .filter((proposal) => !proposal.duplicate)
            .map((proposal) => proposal.sourceKey),
        ),
      );
      if (result.error) toast.error(result.error);
      else if (result.success) toast.success(result.success);
    });
  }

  function handleCreate() {
    startCreateTransition(async () => {
      const result: CreateAiSubtasksState = await createAiSubtasksAction(
        projectId,
        taskId,
        selectedProposals,
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.success) toast.success(result.success);
      setOpen(false);
      router.refresh();
    });
  }

  function toggleProposal(sourceKey: string, checked: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(sourceKey);
      else next.delete(sourceKey);
      return next;
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
          ? {
              ...proposal,
              [field]: field === "devEstimateHours" ? Number(value) : value,
            }
          : proposal,
      ),
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
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Tự động phân rã sub-task</DialogTitle>
          <DialogDescription>
            AI phân tích task cha và đề xuất công việc tối đa 8 giờ cho một middle developer.
            Hãy rà soát nội dung trước khi tạo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <SummaryItem label="Đề xuất" value={String(proposals.length)} />
          <SummaryItem label="Đã chọn" value={String(selectedProposals.length)} />
          <SummaryItem label="Tổng Dev estimate" value={`${totalEstimate}h`} />
        </div>

        {effectiveParentEstimate > 0 && totalEstimate > effectiveParentEstimate ? (
          <div className="flex items-start gap-2 rounded-[10px] border bg-muted/40 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              Tổng estimate sub-task ({totalEstimate}h) đang vượt estimate task cha (
              {effectiveParentEstimate}h). Bạn vẫn có thể tạo sau khi rà soát.
            </p>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {proposals.length > 0 ? (
            <div className="space-y-3">
              {proposals.map((proposal, index) => {
                const selected = selectedKeys.has(proposal.sourceKey);
                return (
                  <div key={proposal.sourceKey} className="rounded-[14px] border p-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`subtask-${proposal.sourceKey}`}
                        className="mt-1"
                        checked={selected}
                        disabled={proposal.duplicate}
                        onCheckedChange={(checked) =>
                          toggleProposal(proposal.sourceKey, checked === true)
                        }
                      />
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label htmlFor={`subtask-${proposal.sourceKey}`}>
                            Sub-task {index + 1}
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            {proposal.duplicate
                              ? "Đã tồn tại"
                              : `Độ tin cậy ${Math.round(proposal.confidence * 100)}%`}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`subtask-title-${index}`}>Tiêu đề</Label>
                          <Input
                            id={`subtask-title-${index}`}
                            value={proposal.title}
                            disabled={proposal.duplicate}
                            onChange={(event) =>
                              updateProposal(proposal.sourceKey, "title", event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`subtask-description-${index}`}>Mô tả</Label>
                          <Textarea
                            id={`subtask-description-${index}`}
                            rows={7}
                            value={proposal.description}
                            disabled={proposal.duplicate}
                            onChange={(event) =>
                              updateProposal(proposal.sourceKey, "description", event.target.value)
                            }
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                          <div className="space-y-1">
                            <Label htmlFor={`subtask-acceptance-${index}`}>
                              Tiêu chí nghiệm thu
                            </Label>
                            <Textarea
                              id={`subtask-acceptance-${index}`}
                              rows={4}
                              value={proposal.acceptanceCriteria}
                              disabled={proposal.duplicate}
                              onChange={(event) =>
                                updateProposal(
                                  proposal.sourceKey,
                                  "acceptanceCriteria",
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`subtask-estimate-${index}`}>Dev estimate (giờ)</Label>
                            <Input
                              id={`subtask-estimate-${index}`}
                              type="number"
                              min="0.5"
                              max="8"
                              step="0.5"
                              value={proposal.devEstimateHours}
                              disabled={proposal.duplicate}
                              onChange={(event) =>
                                updateProposal(
                                  proposal.sourceKey,
                                  "devEstimateHours",
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-48 items-center justify-center rounded-[14px] border border-dashed p-6 text-center text-sm text-muted-foreground">
              {previewPending
                ? "AI đang phân tích nội dung task..."
                : preview.success || preview.error || "Bấm “Phân tích task” để tạo bản preview."}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={previewPending || createPending}
            onClick={handlePreview}
          >
            <Sparkles className="size-3.5" />
            {previewPending ? "Đang phân tích..." : proposals.length > 0 ? "Phân tích lại" : "Phân tích task"}
          </Button>
          <Button
            type="button"
            disabled={
              previewPending ||
              createPending ||
              selectedProposals.length === 0 ||
              selectedProposals.some(
                (proposal) =>
                  !Number.isFinite(proposal.devEstimateHours) ||
                  proposal.devEstimateHours < 0.5 ||
                  proposal.devEstimateHours > 8,
              )
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border bg-muted/30 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
