'use server';

import { createSession, deleteSession } from '../session';
import { redirect } from 'next/navigation';
import argon2 from "argon2";
import { SigninSchema, SignupSchema } from '../schema/auth';
import { isPublicRegistrationEnabled } from '../server/settings';
import {
  createUser,
  getUserByUsername,
  getUserCount,
  recordUserLogin,
} from '../server/users';

export type AuthFormState = {
  errors?: {
    username?: string[]
    password?: string[]
    name?: string[]
    confirmPassword?: string[]
  }
  message?: string
  success?: boolean
} | undefined

export async function signinAction(_state: AuthFormState, data: FormData) {
  const validatedFields = SigninSchema.safeParse({
    username: data.get('username'),
    password: data.get('password'),
  });
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { username, password } = validatedFields.data
  const user = await getUserByUsername(username);
  if (!user) {
    return { message: '用户名不存在。' }
  }

  if (user.isDisabled) {
    return { message: '账号已被禁用，请联系管理员。' }
  }

  if (!(await argon2.verify(user.passwordHash, password))) {
    return { message: '用户名或密码错误。' }
  }

  await recordUserLogin(user.id);
  await createSession(user.id);
  return { success: true }
}

export async function signupAction(_state: AuthFormState, data: FormData) {
  const validatedFields = SignupSchema.safeParse({
    name: data.get('name'),
    username: data.get('username'),
    password: data.get('password'),
    confirmPassword: data.get('confirmPassword'),
  });
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { name, username, password, confirmPassword } = validatedFields.data

  const [registrationEnabled, userCount] = await Promise.all([
    isPublicRegistrationEnabled(),
    getUserCount(),
  ]);

  if (!registrationEnabled && userCount > 0) {
    return { message: '公开注册已关闭，请联系管理员创建账号。' }
  }

  if (password !== confirmPassword) {
    return { errors: { confirmPassword: ['两次输入的密码不匹配。'] } }
  }

  const existingUser = await getUserByUsername(username);
  if (existingUser) {
    return { message: '用户名已存在。' }
  }

  const hashedPassword = await argon2.hash(password);
  try {
    const user = await createUser({ name, username, passwordHash: hashedPassword });
    await recordUserLogin(user.id);
    await createSession(user.id);
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : '注册失败，请重试。',
    }
  }
  return { success: true }
}

export async function signoutAction() {
  await deleteSession();
  redirect('/')
}
