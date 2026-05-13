'use client'

import { cn } from "@/library/utils"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import Link from 'next/link'
import { signinAction } from '@/library/actions/auth';
import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { SigninSchema } from '@/library/schema/auth'
import z from 'zod'
import { ThemeToggle } from '../theme-toggle'

export function SigninForm({ className, ...props }: React.ComponentProps<"div">) {

  const [state, action, pending] = useActionState(signinAction, undefined)
  const router = useRouter()

  const [params, setParams] = useState<z.infer<typeof SigninSchema>>({ username: '', password: '' });

  useEffect(() => {
    if (state?.message) {
      toast.error(state?.message)
    }
    if (state?.success) {
      toast.success('登录成功')
      setTimeout(() => router.push('/'), 500)
    }
  }, [router, state])

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>登录到你的账号</CardTitle>
          <CardDescription>
            在下方输入你的用户名以登录你的账号
          </CardDescription>
          <CardAction>
            <ThemeToggle />
          </CardAction>
        </CardHeader>
        <CardContent>
          <form action={action}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">用户名</FieldLabel>
                <Input id="username" name="username" type="text" placeholder="用户名" required
                  value={params.username} onChange={(e) => { setParams({ ...params, username: e.target.value }) }} />
                {state?.errors?.username && <FieldError>{state.errors.username.join(', ')}</FieldError>}
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">密码</FieldLabel>
                  <Link href="#" className="ml-auto inline-block text-sm underline-offset-4 hover:underline">
                    忘记密码？
                  </Link>
                </div>
                <Input id="password" name="password" type="password" required
                  value={params.password} onChange={(e) => { setParams({ ...params, password: e.target.value }) }} />
                {state?.errors?.password && <FieldError>{state.errors.password.join(', ')}</FieldError>}
              </Field>
              <Field>
                <Button disabled={pending} type="submit">登录</Button>
                <Button nativeButton={false} variant="outline" render={<Link href="/" />}>
                  返回首页
                </Button>
                <FieldDescription className="text-center">
                  没有账号？<Link href="/signup">注册</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
