import { notFound, redirect } from "next/navigation";
import { isBotOwner } from "@/lib/owners";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Owner-only area. Non-owners get a plain 404 so the pages are not even
 * discoverable by URL.
 */
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");

  if (!(await isBotOwner(session.user.discordId))) notFound();

  return <>{children}</>;
}
