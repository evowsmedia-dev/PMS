import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertDailySnapshot } from "@/lib/reports/snapshot";

/**
 * Daily snapshot cron. Protected by CRON_SECRET: Vercel Cron sends the secret in
 * the Authorization header ("Bearer <secret>"); a matching `?secret=` query is
 * also accepted for manual triggering. Iterates active projects and upserts one
 * DailyProjectSnapshot per project for today.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const auth = request.headers.get("authorization");
  const provided = auth?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret") ?? "";
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });

  let ok = 0;
  for (const p of projects) {
    try {
      await upsertDailySnapshot(p.id);
      ok += 1;
    } catch {
      // Continue with remaining projects even if one fails.
    }
  }

  return NextResponse.json({ ok: true, projects: projects.length, snapshots: ok });
}
