"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  updateNameAction,
  updatePasswordAction,
} from "@/library/actions/account";

type AccountFormsProps = {
  user: {
    name: string;
    username: string;
  };
};

export function AccountForms({ user }: AccountFormsProps) {
  const [nameState, nameAction, namePending] = useActionState(
    updateNameAction,
    undefined
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    updatePasswordAction,
    undefined
  );
  const [name, setName] = useState(user.name);

  useEffect(() => {
    if (nameState?.message) {
      if (nameState.success) {
        toast.success(nameState.message);
      } else {
        toast.error(nameState.message);
      }
    }
  }, [nameState]);

  useEffect(() => {
    if (passwordState?.message) {
      if (passwordState.success) {
        toast.success(passwordState.message);
      } else {
        toast.error(passwordState.message);
      }
    }
  }, [passwordState]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>账户信息</CardTitle>
          <CardDescription>用户名不可修改，可以更新显示姓名。</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={nameAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">用户名</FieldLabel>
                <Input id="username" value={user.username} disabled readOnly />
                <FieldDescription>用户名用于登录，目前不可修改。</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="name">姓名</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
                {nameState?.errors?.name ? (
                  <FieldError>{nameState.errors.name.join(", ")}</FieldError>
                ) : null}
              </Field>
              <Field>
                <Button type="submit" disabled={namePending}>
                  保存姓名
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
          <CardDescription>输入当前密码后设置一个新密码。</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={passwordAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="currentPassword">当前密码</FieldLabel>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  required
                />
                {passwordState?.errors?.currentPassword ? (
                  <FieldError>
                    {passwordState.errors.currentPassword.join(", ")}
                  </FieldError>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="password">新密码</FieldLabel>
                <Input id="password" name="password" type="password" required />
                {passwordState?.errors?.password ? (
                  <FieldError>{passwordState.errors.password.join(", ")}</FieldError>
                ) : null}
                <FieldDescription>新密码至少需要 6 个字符。</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirmPassword">确认新密码</FieldLabel>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                />
                {passwordState?.errors?.confirmPassword ? (
                  <FieldError>
                    {passwordState.errors.confirmPassword.join(", ")}
                  </FieldError>
                ) : null}
              </Field>
              <Field>
                <Button type="submit" disabled={passwordPending}>
                  更新密码
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
