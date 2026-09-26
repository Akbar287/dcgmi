import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { authConfig } from "@/auth.config";
import { verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db/client";
import { credentialsSchema } from "@/lib/validation/auth";

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

class NotRegistered extends CredentialsSignin {
  code = "NotRegistered";
}

// Only accounts an Admin registered beforehand may sign in, whatever the provider.
async function findActiveUser(email: string) {
  const prisma = await db();
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  return user?.active ? user : null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...(googleEnabled ? [Google] : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await findActiveUser(parsed.data.email);
        if (!user?.passwordHash) throw new NotRegistered();
        if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      if (!profile?.email_verified || !user.email) return "/login?error=NotRegistered";
      return (await findActiveUser(user.email)) ? true : "/login?error=NotRegistered";
    },
    async jwt({ token, account }) {
      // Resolve our own user id and role once, at sign-in; Google's `user.id`
      // is the provider subject, not ours.
      if (account && token.email) {
        const user = await findActiveUser(token.email);
        if (user) {
          token.uid = user.id;
          token.role = user.role;
          token.name = user.name ?? token.name;
        }
      }
      return token;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (!user.email) return;
      const prisma = await db();
      const stored = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
      if (!stored) return;
      await prisma.$transaction([
        prisma.user.update({ where: { id: stored.id }, data: { lastLoginAt: new Date(), image: user.image ?? stored.image } }),
        prisma.auditEvent.create({
          data: {
            actorId: stored.id,
            actorKind: "USER",
            action: "AUTH_SIGN_IN",
            targetType: "User",
            targetId: stored.id,
            payload: { provider: account?.provider ?? "unknown" },
          },
        }),
      ]);
    },
  },
});
