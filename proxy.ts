import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

// Optimistic gatekeeping from the JWT cookie only (no database in the proxy).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp)$).*)"],
};
