"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function updateProfileAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const fullName = String(formData.get("fullName") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();

  if (!fullName) return { error: "Họ tên không được để trống." };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { fullName, department: department || null },
  });

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: session.user.id,
    metadata: { field: "profile" },
  });

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/overview");
  return { success: "Đã cập nhật hồ sơ." };
}

export async function changePasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    return { error: "Mật khẩu mới phải có ít nhất 8 ký tự." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Xác nhận mật khẩu không khớp." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "Không tìm thấy người dùng." };

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { error: "Mật khẩu hiện tại không đúng." };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustResetPassword: false },
  });

  await logAudit({
    actorId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    metadata: { field: "password" },
  });

  return { success: "Đã đổi mật khẩu." };
}
