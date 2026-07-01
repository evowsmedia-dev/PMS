"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/profile";

function generateTempPassword() {
  return Math.random().toString(36).slice(-8) + "A1!";
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.systemRole !== "ADMIN") return null;
  return session;
}

export interface CreateUserState extends ActionState {
  tempPassword?: string;
}

export async function createUserAction(
  _prevState: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const session = await requireAdmin();
  if (!session) return { error: "Bạn không có quyền thực hiện thao tác này." };

  const email = String(formData.get("email") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const systemRole = String(formData.get("systemRole") ?? "DEV");

  if (!email || !fullName) return { error: "Vui lòng nhập đầy đủ email và họ tên." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Email đã tồn tại." };

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      department: department || null,
      systemRole: systemRole as never,
      passwordHash,
      mustResetPassword: true,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "User",
    entityId: user.id,
    metadata: { email },
  });

  revalidatePath("/admin/users");
  return { success: `Đã tạo tài khoản ${email}.`, tempPassword };
}

export async function toggleUserActiveAction(userId: string) {
  const session = await requireAdmin();
  if (!session) return;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.user.update({ where: { id: userId }, data: { isActive: !user.isActive } });

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: userId,
    metadata: { isActive: !user.isActive },
  });

  revalidatePath("/admin/users");
}

export async function changeUserSystemRoleAction(userId: string, systemRole: string) {
  const session = await requireAdmin();
  if (!session) return;

  await prisma.user.update({ where: { id: userId }, data: { systemRole: systemRole as never } });

  await logAudit({
    actorId: session.user.id,
    action: "ROLE_CHANGE",
    entityType: "User",
    entityId: userId,
    metadata: { systemRole },
  });

  revalidatePath("/admin/users");
}

export async function resetUserPasswordAction(
  userId: string,
): Promise<{ tempPassword?: string; error?: string }> {
  const session = await requireAdmin();
  if (!session) return { error: "Không có quyền." };

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustResetPassword: true },
  });

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: userId,
    metadata: { field: "password-reset-by-admin" },
  });

  revalidatePath("/admin/users");
  return { tempPassword };
}

export async function updateSystemSettingsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();
  if (!session) return { error: "Bạn không có quyền thực hiện thao tác này." };

  const systemName = String(formData.get("systemName") ?? "").trim();
  const systemEmail = String(formData.get("systemEmail") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();

  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: "systemName" },
      update: { value: systemName },
      create: { key: "systemName", value: systemName },
    }),
    prisma.systemSetting.upsert({
      where: { key: "systemEmail" },
      update: { value: systemEmail },
      create: { key: "systemEmail", value: systemEmail },
    }),
    prisma.systemSetting.upsert({
      where: { key: "logoUrl" },
      update: { value: logoUrl },
      create: { key: "logoUrl", value: logoUrl },
    }),
  ]);

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "SystemSetting",
  });

  revalidatePath("/admin/settings");
  return { success: "Đã lưu cấu hình hệ thống." };
}
