"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { FileText, Sparkles } from "lucide-react";
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
import {
  createAutoTasksFromDocumentsAction,
  previewAutoTasksFromDocumentsAction,
  type AutoGenerateTasksState,
  type AutoTaskPreviewCandidate,
  type AutoTaskPreviewState,
} from "@/lib/actions/tasks";

export function AutoTaskFromDocumentsDialog({
  projectId,
  documentCount,
}: {
  projectId: string;
  documentCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<AutoTaskPreviewState>({});
  const [createResult, setCreateResult] = useState<AutoGenerateTasksState>({});
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [previewPending, startPreviewTransition] = useTransition();
  const [createPending, startCreateTransition] = useTransition();

  const proposals = useMemo(() => preview.proposals ?? [], [preview.proposals]);
  const selectableProposals = useMemo(
    () => proposals.filter((proposal) => !proposal.duplicate),
    [proposals],
  );
  const selectedProposals = useMemo(
    () => selectableProposals.filter((proposal) => selectedKeys.has(candidateKey(proposal))),
    [selectableProposals, selectedKeys],
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;
    setPreview({});
    setCreateResult({});
    setSelectedKeys(new Set());
  }

  useEffect(() => {
    if (preview.error) toast.error(preview.error);
    if (preview.success && preview.proposals) toast.success(preview.success);
  }, [preview]);

  useEffect(() => {
    if (createResult.error) toast.error(createResult.error);
    if (createResult.success) toast.success(createResult.success);
  }, [createResult]);

  function handlePreview() {
    setCreateResult({});
    startPreviewTransition(async () => {
      const result = await previewAutoTasksFromDocumentsAction(projectId);
      setPreview(result);
      setSelectedKeys(new Set((result.proposals ?? []).filter((proposal) => !proposal.duplicate).map(candidateKey)));
    });
  }

  function handleCreate() {
    startCreateTransition(async () => {
      const result = await createAutoTasksFromDocumentsAction(projectId, selectedProposals);
      setCreateResult(result);
      if (result.success) {
        setPreview((current) => ({
          ...current,
          proposals: current.proposals?.map((proposal) =>
            selectedKeys.has(candidateKey(proposal)) ? { ...proposal, duplicate: true } : proposal,
          ),
        }));
        setSelectedKeys(new Set());
      }
    });
  }

  function toggleCandidate(candidate: AutoTaskPreviewCandidate, checked: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      const key = candidateKey(candidate);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full sm:w-auto">
          <Sparkles className="size-3.5" />
          Tự động tạo task từ tài liệu
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tự động tạo task từ tài liệu</DialogTitle>
          <DialogDescription>
            AI sẽ đọc logic tài liệu, đề xuất task Backlog chưa gán người phụ trách, sau đó bạn chọn task cần tạo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[14px] border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Tài liệu active</p>
            <p className="mt-2 text-2xl font-semibold leading-none">{documentCount}</p>
          </div>
          <div className="rounded-[14px] border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">AI đề xuất</p>
            <p className="mt-2 text-2xl font-semibold leading-none">{preview.candidates ?? 0}</p>
          </div>
          <div className="rounded-[14px] border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Đã chọn</p>
            <p className="mt-2 text-2xl font-semibold leading-none">{selectedProposals.length}</p>
          </div>
        </div>

        <div className="rounded-[14px] border p-3 text-sm">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 size-4 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">Format task bắt buộc</p>
              <p className="text-muted-foreground">
                Hệ thống cần làm gì &gt; người dùng muốn làm gì &gt; điều kiện thế nào là đúng &gt; dev/test cần làm gì để hoàn thành.
              </p>
            </div>
          </div>
        </div>

        {preview.error ? <p className="text-sm font-medium">{preview.error}</p> : null}
        {createResult.success ? (
          <div className="rounded-[14px] border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{createResult.success}</p>
            <p className="mt-1 text-muted-foreground">
              Đã quét {createResult.scannedDocuments ?? 0} tài liệu, xử lý {createResult.candidates ?? 0} proposal.
            </p>
          </div>
        ) : null}

        {proposals.length > 0 ? (
          <div className="max-h-[42vh] min-h-0 overflow-y-auto rounded-[14px] border">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-3 py-2 text-xs text-muted-foreground">
              <span>Preview task AI đề xuất</span>
              <span>{selectableProposals.length} task có thể tạo</span>
            </div>
            <div className="divide-y">
              {proposals.map((proposal) => {
                const key = candidateKey(proposal);
                const checked = selectedKeys.has(key);
                return (
                  <label
                    key={key}
                    className="flex cursor-pointer gap-3 px-3 py-3 hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={proposal.duplicate}
                      onCheckedChange={(value) => toggleCandidate(proposal, value === true)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 flex-1 text-sm font-semibold">{proposal.title}</p>
                        <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                          {proposal.type}
                        </span>
                        <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                          {Math.round(proposal.confidence * 100)}%
                        </span>
                        {proposal.duplicate ? (
                          <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium">
                            Đã tồn tại
                          </span>
                        ) : null}
                        {proposal.needsClarification ? (
                          <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium">
                            Cần rà soát
                          </span>
                        ) : null}
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        Nguồn: {proposal.sourceEvidence}
                      </p>
                      <p className="line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">
                        {proposal.acceptanceCriteria}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Đóng
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={previewPending || createPending || documentCount === 0}
              onClick={handlePreview}
            >
              {previewPending ? "AI đang phân tích..." : "Tạo preview"}
            </Button>
            <Button
              type="button"
              disabled={createPending || previewPending || selectedProposals.length === 0}
              onClick={handleCreate}
            >
              {createPending ? "Đang tạo..." : "Tạo task đã chọn"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function candidateKey(candidate: Pick<AutoTaskPreviewCandidate, "documentId" | "sourceKey">) {
  return `${candidate.documentId}:${candidate.sourceKey}`;
}
