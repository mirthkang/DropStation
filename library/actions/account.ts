"use server";

import { revalidatePath } from "next/cache";
import argon2 from "argon2";
import z from "zod";

import { getSession } from "@/library/session";
import {
  getUserById,
  updateUserName,
  updateUserPassword,
} from "@/library/server/users";

export type AccountFormState = {
  errors?: {
    name?: string[];
    currentPassword?: string[];
    password?: string[];
    confirmPassword?: string[];
  };
  message?: string;
  success?: boolean;
} | undefined;

const UpdateNameSchema = z.object({
  name: z.string().min(1, { error: "姓名不能为空" }).trim(),
});

const UpdatePasswordSchema = z.object({
  currentPassword: z.string().min(1, { error: "当前密码不能为空" }),
  password: z.string().min(6, { error: "新密码至少需要6个字符" }).trim(),
  confirmPassword: z.string().min(6, { error: "确认密码至少需要6个字符" }).trim(),
});

export async function updateNameAction(
  _state: AccountFormState,
  data: FormData
) {
  const session = await getSession();

  if (!session?.userId) {
    return { message: "请先登录。" };
  }

  const validatedFields = UpdateNameSchema.safeParse({
    name: data.get("name"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  await updateUserName(session.userId, validatedFields.data.name);
  revalidatePath("/");
  revalidatePath("/account");

  return { success: true, message: "姓名已更新。" };
}

export async function updatePasswordAction(
  _state: AccountFormState,
  data: FormData
) {
  const session = await getSession();

  if (!session?.userId) {
    return { message: "请先登录。" };
  }

  const validatedFields = UpdatePasswordSchema.safeParse({
    currentPassword: data.get("currentPassword"),
    password: data.get("password"),
    confirmPassword: data.get("confirmPassword"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { currentPassword, password, confirmPassword } = validatedFields.data;

  if (password !== confirmPassword) {
    return { errors: { confirmPassword: ["两次输入的密码不匹配。"] } };
  }

  const user = await getUserById(session.userId);

  if (!user) {
    return { message: "用户不存在，请重新登录。" };
  }

  if (!(await argon2.verify(user.passwordHash, currentPassword))) {
    return { message: "当前密码错误。" };
  }

  const passwordHash = await argon2.hash(password);
  await updateUserPassword(session.userId, passwordHash);

  return { success: true, message: "密码已更新。" };
}
