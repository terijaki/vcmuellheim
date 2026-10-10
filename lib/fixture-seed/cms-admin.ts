import { z } from "zod";
import type { createDb } from "@/lib/db/electrodb-client";

type Db = ReturnType<typeof createDb>;

export type GrantCmsAdminResult =
  | { status: "created"; email: string }
  | { status: "updated"; email: string }
  | { status: "unchanged"; email: string; authRole: "Admin" | "Moderator" };

const adminEmailSchema = z.string().trim().toLowerCase().pipe(z.email());

/**
 * Ensure a member with the given private email can sign in to the CMS as Admin
 * (passwordless email OTP). Creates a minimal member when none exists.
 */
export async function grantCmsAdmin(db: Db, rawEmail: string): Promise<GrantCmsAdminResult> {
  const email = adminEmailSchema.parse(rawEmail);
  const existing = await db.member.query.byPrivateEmail({ privateEmail: email }).go();
  const member = existing.data[0];

  if (member) {
    if (member.authRole === "Admin" || member.authRole === "Moderator") {
      return { status: "unchanged", email, authRole: member.authRole };
    }

    await db.member
      .patch({ id: member.id })
      .set({ authRole: "Admin", updatedAt: new Date().toISOString() })
      .go();
    return { status: "updated", email };
  }

  const now = new Date().toISOString();
  await db.member
    .create({
      id: crypto.randomUUID(),
      type: "member",
      name: email.split("@")[0] || email,
      privateEmail: email,
      authRole: "Admin",
      createdAt: now,
      updatedAt: now,
    })
    .go();

  return { status: "created", email };
}
