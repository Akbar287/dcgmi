import "dotenv/config";

import { hashPassword } from "../lib/auth/password";
import { prisma } from "../lib/prisma";

/**
 * Admin pertama. Hanya email terdaftar yang boleh masuk, jadi tanpa ini tidak
 * ada yang bisa masuk sama sekali. Akun yang sudah ada tidak diubah: menjalankan
 * ulang tidak boleh diam-diam mengganti peran atau kata sandi.
 *
 * Dipanggil oleh seed.ts, dan dapat dijalankan sendiri (`pnpm db:seed:admin`)
 * tanpa mengulang seed baseline yang tidak idempoten untuk konfigurasi panel.
 */
export async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.log("  Admin: ADMIN_EMAIL kosong — lewati. Isi ADMIN_EMAIL lalu jalankan pnpm db:seed:admin.");
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`  Admin: ${email} sudah terdaftar (${existing.role}) — tidak diubah`);
    return;
  }
  const password = process.env.ADMIN_PASSWORD;
  const user = await prisma.user.create({
    data: { email, role: "ADMIN", passwordHash: password ? await hashPassword(password) : null },
  });
  await prisma.auditEvent.create({
    data: {
      actorKind: "SYSTEM",
      action: "USER_CREATE",
      targetType: "User",
      targetId: user.id,
      payload: { email, role: "ADMIN", password: Boolean(password), source: "seed" },
    },
  });
  console.log(`  Admin: ${email} dibuat${password ? " (dengan kata sandi)" : " (masuk lewat Google)"}`);
}

// Run directly: `tsx prisma/seed-admin.ts`.
if (process.argv[1]?.endsWith("seed-admin.ts")) {
  seedAdmin()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
