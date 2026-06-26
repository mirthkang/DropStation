import { notFound, redirect } from "next/navigation";

import { getSession } from "@/library/session";
import { getUserById } from "@/library/server/users";

export async function requireAdminUser() {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/signin");
  }

  const user = await getUserById(session.userId);

  if (!user) {
    redirect("/signin");
  }

  if (!user.isAdmin) {
    notFound();
  }

  return user;
}

export async function isCurrentUserAdmin() {
  const session = await getSession();

  if (!session?.userId) {
    return false;
  }

  const user = await getUserById(session.userId);
  return Boolean(user?.isAdmin);
}
