import bcrypt from "bcryptjs";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { RFID_TEMPLATE_DOCS } from "./rfid-template";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      fullName: "System Admin",
      systemRole: "ADMIN",
    },
  });

  console.log(`Seeded admin user: ${admin.email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`  (default password: ${password} - change this after first login)`);
  }

  const existingTemplate = await prisma.template.findFirst({
    where: { name: "Kho RFID" },
  });
  if (!existingTemplate) {
    await prisma.template.create({
      data: {
        name: "Kho RFID",
        description:
          "Bộ tài liệu chuẩn 7 danh mục (Quản lý, Yêu cầu, Kỹ thuật, Kiểm thử, Tiến độ, Kiến thức, Lịch sử) cho một dự án.",
        isDefault: true,
        structure: { docs: RFID_TEMPLATE_DOCS } as unknown as Prisma.InputJsonValue,
        createdById: admin.id,
      },
    });
    console.log('Seeded template: "Kho RFID"');
  } else {
    console.log('Template "Kho RFID" already exists, skipping.');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
