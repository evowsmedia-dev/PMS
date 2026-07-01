import type { DefaultSession } from "next-auth";
import type { SystemRole } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface User {
    systemRole?: SystemRole;
    mustResetPassword?: boolean;
    remember?: boolean;
  }

  interface Session {
    user: {
      id: string;
      systemRole: SystemRole;
      mustResetPassword: boolean;
    } & DefaultSession["user"];
    fullName?: string;
    avatarUrl?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    systemRole?: SystemRole;
    mustResetPassword?: boolean;
    issuedAt?: number;
    maxAgeSeconds?: number;
  }
}
