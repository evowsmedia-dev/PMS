import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { SystemRole } from "@/generated/prisma/enums";

const SESSION_MAX_AGE_REMEMBER = 30 * 24 * 60 * 60; // 30 days
const SESSION_MAX_AGE_DEFAULT = 8 * 60 * 60; // 8 hours

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_REMEMBER,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        await logAudit({
          actorId: user.id,
          action: "LOGIN",
          entityType: "User",
          entityId: user.id,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          image: user.avatarUrl,
          systemRole: user.systemRole,
          mustResetPassword: user.mustResetPassword,
          remember: credentials?.remember === "true",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.systemRole = user.systemRole as SystemRole;
        token.mustResetPassword = user.mustResetPassword as boolean;
        token.issuedAt = Date.now();
        token.maxAgeSeconds = user.remember
          ? SESSION_MAX_AGE_REMEMBER
          : SESSION_MAX_AGE_DEFAULT;
      }

      if (trigger === "update" && session) {
        if (typeof session.fullName === "string") token.name = session.fullName;
        if (typeof session.avatarUrl === "string") token.picture = session.avatarUrl;
        if (typeof session.mustResetPassword === "boolean") {
          token.mustResetPassword = session.mustResetPassword;
        }
      }

      const issuedAt = (token.issuedAt as number | undefined) ?? Date.now();
      const maxAgeSeconds =
        (token.maxAgeSeconds as number | undefined) ?? SESSION_MAX_AGE_DEFAULT;
      if (Date.now() - issuedAt > maxAgeSeconds * 1000) {
        return null;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.systemRole = token.systemRole as SystemRole;
        session.user.mustResetPassword = token.mustResetPassword as boolean;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});
