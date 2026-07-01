"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { addDocumentCommentAction, resolveCommentAction } from "@/lib/actions/comments";
import type { ActionState } from "@/lib/actions/profile";
import { useQuote } from "@/components/document-detail-shell";

const initialState: ActionState = {};

interface CommentItem {
  id: string;
  content: string;
  quotedText: string | null;
  resolved: boolean;
  createdAt: string;
  author: { fullName: string };
}

export function DocumentComments({
  projectId,
  moduleId,
  docId,
  comments,
  canComment,
}: {
  projectId: string;
  moduleId: string;
  docId: string;
  comments: CommentItem[];
  canComment: boolean;
}) {
  const action = addDocumentCommentAction.bind(null, projectId, moduleId, docId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();
  const { quote, setQuote } = useQuote();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      setQuote(null);
      formRef.current?.reset();
    }
  }, [state, setQuote]);

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        Nhận xét & Ghi chú ({comments.length})
      </p>

      <div className="max-h-96 space-y-2 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có nhận xét nào.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="border-b pb-2 last:border-none">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{c.author.fullName}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(c.createdAt).toLocaleString("vi-VN")}
                </span>
              </div>
              {c.quotedText ? (
                <blockquote className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs italic text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  &ldquo;{c.quotedText}&rdquo;
                </blockquote>
              ) : null}
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
              {canComment ? (
                <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={c.resolved}
                    onCheckedChange={(checked) =>
                      startTransition(() =>
                        resolveCommentAction(
                          projectId,
                          moduleId,
                          docId,
                          c.id,
                          checked === true,
                        ),
                      )
                    }
                  />
                  Đã xử lý
                </label>
              ) : null}
            </div>
          ))
        )}
      </div>

      {canComment ? (
        <form ref={formRef} action={formAction} className="space-y-2">
          {quote ? (
            <div className="flex items-start justify-between gap-2 rounded bg-amber-50 px-2 py-1.5 text-xs italic text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <span>&ldquo;{quote}&rdquo;</span>
              <button
                type="button"
                onClick={() => setQuote(null)}
                className="shrink-0 text-amber-800/70 hover:text-amber-800 dark:text-amber-200/70"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : null}
          <input type="hidden" name="quotedText" value={quote ?? ""} readOnly />
          <Textarea
            name="content"
            rows={2}
            placeholder="Viết nhận xét... dùng @tên để nhắc thành viên"
            required
          />
          <Button type="submit" size="sm" className="w-full" disabled={pending}>
            {pending ? "Đang gửi..." : "Gửi nhận xét"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
