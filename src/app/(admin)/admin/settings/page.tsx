import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SystemSettingsForm } from "@/components/system-settings-form";
import { PageShell, PageSection } from "@/components/page-shell";
import { AdminRoleSettings } from "@/components/admin-role-settings";
import { PermissionMatrixSettings } from "@/components/permission-matrix-settings";
import {
  EDITABLE_RBAC_ACTIONS,
  PROJECT_ROLE_OPTIONS,
  RBAC_ACTION_LABELS,
  getPermissionMatrix,
} from "@/lib/rbac";

export default async function AdminSettingsPage() {
  const [settings, users, permissionMatrix] = await Promise.all([
    prisma.systemSetting.findMany(),
    prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
      select: {
        id: true,
        fullName: true,
        email: true,
        systemRole: true,
        isActive: true,
      },
    }),
    getPermissionMatrix(),
  ]);
  const get = (key: string) => (settings.find((s) => s.key === key)?.value as string) ?? "";

  return (
    <PageShell size="standard">
      <PageSection>
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
          <CardTitle className="text-sm">Chỉnh sửa phân quyền user</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminRoleSettings users={users} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ma trận quyền theo vai trò</CardTitle>
        </CardHeader>
        <CardContent>
          <PermissionMatrixSettings
            actions={EDITABLE_RBAC_ACTIONS}
            roles={PROJECT_ROLE_OPTIONS}
            labels={RBAC_ACTION_LABELS}
            matrix={permissionMatrix}
          />
        </CardContent>
      </Card>
      </PageSection>
    </PageShell>
  );
}
