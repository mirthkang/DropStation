"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/library/session";
import { deleteSharedFileByOwner } from "@/library/server/storage";

export async function deleteShareAction(formData: FormData) {
  const session = await getSession();
  const token = formData.get("token");

  if (!session?.userId || typeof token !== "string" || !token) {
    return;
  }

  await deleteSharedFileByOwner(token, session.userId);
  revalidatePath("/shares");
}
