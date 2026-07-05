"use client";

import { useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function ImagePreviewScope({ children }: { children: React.ReactNode }) {
  const [image, setImage] = useState<{ src: string; alt: string } | null>(null);
  const [zoom, setZoom] = useState(1);

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target;

    if (!(target instanceof HTMLImageElement)) return;

    setZoom(1);
    setImage({ src: target.currentSrc || target.src, alt: target.alt || "Ảnh" });
  }

  function updateOpen(open: boolean) {
    if (!open) {
      setImage(null);
      setZoom(1);
    }
  }

  return (
    <>
      <div onClick={handleClick} className="[&_img]:cursor-zoom-in">
        {children}
      </div>
      <Dialog open={Boolean(image)} onOpenChange={updateOpen}>
        <DialogContent className="h-screen max-h-screen w-screen max-w-none gap-3 rounded-none p-3" showCloseButton>
          <div className="flex items-center justify-between gap-2 border-b pb-2 pr-9">
            <DialogTitle className="truncate text-sm">{image?.alt || "Ảnh"}</DialogTitle>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Thu nhỏ"
                onClick={() => setZoom((value) => Math.max(0.25, Number((value - 0.25).toFixed(2))))}
              >
                <ZoomOut className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Về mặc định"
                onClick={() => setZoom(1)}
              >
                <RotateCcw className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Phóng to"
                onClick={() => setZoom((value) => Math.min(4, Number((value + 0.25).toFixed(2))))}
              >
                <ZoomIn className="size-4" />
              </Button>
            </div>
          </div>
          <div className="min-h-0 overflow-auto bg-muted/20">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- viewer supports external uploaded image URLs.
              <img
                src={image.src}
                alt={image.alt}
                className="mx-auto block max-w-none object-contain"
                style={{ width: `${zoom * 100}%` }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
