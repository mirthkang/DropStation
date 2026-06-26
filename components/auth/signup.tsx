'use client'

import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import Link from 'next/link'
import { signupAction } from '@/library/actions/auth'
import { useActionState, useEffect, useState } from 'react'
import z from 'zod'
import { SignupSchema } from '@/library/schema/auth'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '../theme-toggle'

export function SignupForm({
  registrationEnabled = true,
  ...props
}: React.ComponentProps<typeof Card> & { registrationEnabled?: boolean }) {

  const [state, action, pending] = useActionState(signupAction, undefined)
  const router = useRouter()

  const [params, setParams] = useState<z.infer<typeof SignupSchema>>({ name: '', username: '', password: '', confirmPassword: '' });

  useEffect(() => {
    if (state?.message) {
      toast.error(state?.message)
    }
    if (state?.success) {
      toast.success('注册成功')
      setTimeout(() => router.push('/'), 500)
    }
  }, [router, state])

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>创建账号</CardTitle>
        <CardDescription>
          {registrationEnabled
            ? "在下方输入你的信息以创建账号"
            : "公开注册已关闭，请联系管理员创建账号"}
        </CardDescription>
        <CardAction>
          <ThemeToggle />
        </CardAction>
      </CardHeader>
      <CardContent>
        <form action={action}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">姓名</FieldLabel>
              <Input id="name" name='name' type="text" placeholder="张三" required disabled={!registrationEnabled}
                value={params.name} onChange={(e) => { setParams({ ...params, name: e.target.value }) }} />
              {state?.errors?.name && <FieldError>{state.errors.name.join(', ')}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="username">用户名</FieldLabel>
              <Input id="username" name="username" type="text" placeholder="用户名" required disabled={!registrationEnabled}
                value={params.username} onChange={(e) => { setParams({ ...params, username: e.target.value }) }} />
              {state?.errors?.username && <FieldError>{state.errors.username.join(', ')}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="password">密码</FieldLabel>
              <Input id="password" name="password" type="password" required disabled={!registrationEnabled}
                value={params.password} onChange={(e) => { setParams({ ...params, password: e.target.value }) }} />
              {state?.errors?.password && <FieldError>{state.errors.password.join(', ')}</FieldError>}
              <FieldDescription>密码必须至少包含6个字符。</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmPassword">确认密码</FieldLabel>
              <Input id="confirmPassword" name="confirmPassword" type="password" required disabled={!registrationEnabled}
                value={params.confirmPassword} onChange={(e) => { setParams({ ...params, confirmPassword: e.target.value }) }} />
              {state?.errors?.confirmPassword && <FieldError>{state.errors.confirmPassword.join(', ')}</FieldError>}
              <FieldDescription>请确认您的密码。</FieldDescription>
            </Field>
            <FieldGroup>
              <Field>
                <Button disabled={pending || !registrationEnabled} type="submit">创建账号</Button>
                <Button nativeButton={false} variant="outline" render={<Link href="/" />}>
                  返回首页
                </Button>
                <FieldDescription className="px-6 text-center">
                  已经拥有账号？<Link href="/signin">登录</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
