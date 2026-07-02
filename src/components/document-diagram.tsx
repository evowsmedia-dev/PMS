import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const DEFAULT_TITLE = "Sơ đồ quy trình";

export function DocumentDiagram({
  diagramUrl,
  diagramTitle,
}: {
  diagramUrl: string | null;
  diagramTitle: string | null;
}) {
  if (!diagramUrl) return null;

  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="border-b bg-muted/40 py-3">
        <CardTitle className="text-sm">📊 {diagramTitle || DEFAULT_TITLE}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex min-h-[200px] items-center justify-center bg-muted/20 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- external, unpredictable image host */}
          <img src={diagramUrl} alt={diagramTitle || DEFAULT_TITLE} className="max-w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
