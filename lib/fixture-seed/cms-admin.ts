import { z } from "zod";
import { memberRepository } from "@/lib/db/repositories/member-repository";

export type GrantCmsAdminResult =
  | { status: "created"; email: string }
  | { status: "updated"; email: string }
  | { status: "unchanged"; email: string; authRole: "Admin" | "Moderator" };

const adminEmailSchema = z.string().trim().toLowerCase().pipe(z.email());

/**
 * Ensure a member with the given private email can sign in to the CMS as Admin
 * (passwordless email OTP). Creates a minimal member when none exists.
 */
export async function grantCmsAdmin(_db: unknown, rawEmail: string): Promise<GrantCmsAdminResult> {
  const email = adminEmailSchema.parse(rawEmail);
  const member = await memberRepository.getByPrivateEmail(email);

  if (member) {
    if (member.authRole === "Admin" || member.authRole === "Moderator") {
      return { status: "unchanged", email, authRole: member.authRole };
    }

    await memberRepository.update(member.id, {
      authRole: "Admin",
      updatedAt: new Date().toISOString(),
    });
    return { status: "updated", email };
  }

  const now = new Date().toISOString();
  await memberRepository.create({
    id: crypto.randomUUID(),
    type: "member",
    name: email.split("@")[0] || email,
    privateEmail: email,
    authRole: "Admin",
    createdAt: now,
    updatedAt: now,
  });

  return { status: "created", email };
}
