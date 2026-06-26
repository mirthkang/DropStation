"use server";

import { revalidatePath } from "next/cache";

import { isCurrentUserAdmin } from "@/library/server/admin";
import {
  cleanupExpiredFiles,
  deleteSharedFileByAdmin,
} from "@/library/server/storage";

async function ensureAdminAction() {
  const isAdmin = await isCurrentUserAdmin();

  if (!isAdmin) {
    throw new Error("没有权限执行该操作。");
  }
}

export async function adminDeleteShareAction(formData: FormData) {
  await ensureAdminAction();

  const token = formData.get("token");

  if (typeof token !== "string" || !token) {
    return;
  }

  await deleteSharedFileByAdmin(token);
  revalidatePath("/admin");
}

export async function adminCleanupExpiredFilesAction() {
  await ensureAdminAction();
  await cleanupExpiredFiles();
  revalidatePath("/admin");
}
