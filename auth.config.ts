import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

import { can, homePathFor, isRole } from "@/lib/auth/roles";

const PUBLIC_PREFIXES = ["/login", "/f/", "/api/auth"];

// Proxy-safe half of the config: no Prisma, only the signed JWT. These checks
// are optimistic; lib/auth/session.ts re-reads the role from the database.
export const authConfig = {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const role = isRole(auth?.user?.role) ? auth.user.role : null;

      // `?error=` lets the DAL send a revoked session back to /login without a
      // redirect loop, since the JWT itself is still valid.
      if (pathname === "/login" && role && !request.nextUrl.searchParams.has("error")) {
        return NextResponse.redirect(new URL(homePathFor(role), request.nextUrl));
      }
      if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return true;
      if (!role) return false;
      if (pathname === "/pakar" || pathname.startsWith("/pakar/")) return true;
      return can(role, "console:read") ? true : NextResponse.redirect(new URL(homePathFor(role), request.nextUrl));
    },
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      if (isRole(token.role)) session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
