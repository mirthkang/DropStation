import z from 'zod';

export const SigninSchema = z.object({
  username: z.string().min(3, { error: '用户名至少需要3个字符' }).nonempty({ error: '用户名不能为空' }).trim(),
  password: z.string().min(6, { error: '密码至少需要6个字符' }).nonempty({ error: '密码不能为空' }).trim(),
})

export const SignupSchema = z.object({
  name: z.string().min(1, { error: '姓名不能为空' }).trim(),
  username: z.string().min(3, { error: '用户名至少需要3个字符' }).nonempty({ error: '用户名不能为空' }).trim(),
  password: z.string().min(6, { error: '密码至少需要6个字符' }).nonempty({ error: '密码不能为空' }).trim(),
  confirmPassword: z.string().min(6, { error: '确认密码至少需要6个字符' }).nonempty({ error: '确认密码不能为空' }).trim(),
})