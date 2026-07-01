import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SystemSettingsForm } from "@/components/system-settings-form";

const ROLE_MATRIX: { action: string; roles: string }[] = [
  { action: "Xem tài liệu / task", roles: "Mọi vai trò (Viewer: chỉ xem)" },
  { action: "Tạo / sửa tài liệu, task", roles: "Owner, PO, BA, Dev, Tester" },
  { action: "Phê duyệt tài liệu", roles: "Owner, PO, BA" },
  { action: "Lưu trữ / xóa tài liệu", roles: "Owner, PO (xóa), + BA (lưu trữ)" },
  { action: "Gán lại task", roles: "Owner, PO, BA" },
  { action: "Quản lý thành viên / cài đặt dự án", roles: "Owner, PO" },
  { action: "Quản lý phân hệ", roles: "Owner, PO, BA" },
  { action: "Quản lý template", roles: "Chỉ Admin (systemRole)" },
  { action: "Truy cập /admin/*", roles: "Chỉ Admin (systemRole)" },
];

export default async function AdminSettingsPage() {
  const settings = await prisma.systemSetting.findMany();
  const get = (key: string) => (settings.find((s) => s.key === key)?.value as string) ?? "";

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Cài đặt hệ thống</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cấu hình chung</CardTitle>
        </CardHeader>
        <CardContent>
          <SystemSettingsForm
            systemName={get("systemName") || "PMS"}
            systemEmail={get("systemEmail")}
            logoUrl={get("logoUrl")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Phân quyền theo vai trò (cố định)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ROLE_MATRIX.map((row) => (
            <div key={row.action} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-none">
              <span>{row.action}</span>
              <Badge variant="outline">{row.roles}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
