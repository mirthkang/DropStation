"use server";

import argon2 from "argon2";
import { revalidatePath } from "next/cache";
import z from "zod";

import { getSession } from "@/library/session";
import { setPublicRegistrationEnabled } from "@/library/server/settings";
import { getUserById } from "@/library/server/users";
import {
  cleanupExpiredFiles,
  deleteSharedFileByAdmin,
} from "@/library/server/storage";
import {
  createUser,
  getActiveAdminCount,
  updateUserDisabled,
  updateUserPassword,
} from "@/library/server/users";

async function ensureAdminAction() {
  const session = await getSession();
  const user = session?.userId ? await getUserById(session.userId) : null;

  if (!user?.isAdmin || user.isDisabled) {
    throw new Error("没有权限执行该操作。");
  }

  return user;
}

const AdminCreateUserSchema = z.object({
  name: z.string().min(1, { error: "姓名不能为空" }).trim(),
  username: z.string().min(3, { error: "用户名至少需要3个字符" }).trim(),
  password: z.string().min(6, { error: "密码至少需要6个字符" }).trim(),
});

const ResetPasswordSchema = z.object({
  userId: z.coerce.number().int().positive(),
  password: z.string().min(6, { error: "密码至少需要6个字符" }).trim(),
});

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

export async function adminCreateUserAction(formData: FormData) {
  await ensureAdminAction();

  const validatedFields = AdminCreateUserSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    throw new Error(validatedFields.error.issues[0]?.message ?? "用户信息不完整。");
  }

  const passwordHash = await argon2.hash(validatedFields.data.password);

  await createUser({
    name: validatedFields.data.name,
    username: validatedFields.data.username,
    passwordHash,
    isAdmin: false,
  });

  revalidatePath("/admin/users");
}

export async function adminSetUserDisabledAction(formData: FormData) {
  const admin = await ensureAdminAction();
  const userId = Number(formData.get("userId"));
  const disabled = formData.get("disabled") === "true";

  if (!Number.isInteger(userId) || userId <= 0) {
    return;
  }

  if (userId === admin.id) {
    throw new Error("不能禁用当前登录的管理员。");
  }

  const target = await getUserById(userId);

  if (!target) {
    return;
  }

  if (disabled && target.isAdmin && (await getActiveAdminCount()) <= 1) {
    throw new Error("不能禁用最后一个可用管理员。");
  }

  await updateUserDisabled(userId, disabled);
  revalidatePath("/admin/users");
}

export async function adminResetUserPasswordAction(formData: FormData) {
  await ensureAdminAction();

  const validatedFields = ResetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    throw new Error(validatedFields.error.issues[0]?.message ?? "密码信息不完整。");
  }

  const passwordHash = await argon2.hash(validatedFields.data.password);
  await updateUserPassword(validatedFields.data.userId, passwordHash);
  revalidatePath("/admin/users");
}

export async function adminSetPublicRegistrationAction(formData: FormData) {
  await ensureAdminAction();
  await setPublicRegistrationEnabled(formData.get("enabled") === "true");
  revalidatePath("/admin/users");
  revalidatePath("/signup");
}
