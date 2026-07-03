import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileInfoForm, ChangePasswordForm } from "@/components/profile-form";
import { PageShell, PageSection } from "@/components/page-shell";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  return (
    <PageShell size="compact">
      <PageSection>
      <Card>
        <CardHeader>
          <CardTitle>Hồ sơ cá nhân</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileInfoForm
            fullName={user.fullName}
            department={user.department ?? ""}
            email={user.email}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Đổi mật khẩu</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
      </PageSection>
    </PageShell>
  );
}
