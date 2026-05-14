"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  updateProfileAction,
  updatePasswordAction,
} from "@/library/actions/account";

type AccountFormsProps = {
  user: {
    name: string;
    username: string;
    avatarPath: string | null;
  };
};

export function AccountForms({ user }: AccountFormsProps) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfileAction,
    undefined
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    updatePasswordAction,
    undefined
  );
  const [name, setName] = useState(user.name);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (profileState?.message) {
      if (profileState.success) {
        toast.success(profileState.message);
      } else {
        toast.error(profileState.message);
      }
    }
  }, [profileState]);

  useEffect(() => {
    if (passwordState?.message) {
      if (passwordState.success) {
        toast.success(passwordState.message);
      } else {
        toast.error(passwordState.message);
      }
    }
  }, [passwordState]);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>账户信息</CardTitle>
          <CardDescription>用户名不可修改，可以更新头像和显示姓名。</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={profileAction}>
            <FieldGroup>
              <div className="flex items-center gap-4">
                <UserAvatar
                  name={name}
                  avatarPath={user.avatarPath}
                  src={avatarPreview}
                  size="lg"
                  className="size-16"
                  fallbackClassName="text-lg"
                />
                <Field className="flex-1">
                  <FieldLabel htmlFor="avatar">头像图片</FieldLabel>
                  <Input
                    id="avatar"
                    name="avatar"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      if (file) {
                        setAvatarPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                  {profileState?.errors?.avatar ? (
                    <FieldError>{profileState.errors.avatar.join(", ")}</FieldError>
                  ) : null}
                  <FieldDescription>支持 JPG、PNG、WebP 或 GIF，最大 5MB。</FieldDescription>
                </Field>
              </div>
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
                {profileState?.errors?.name ? (
                  <FieldError>{profileState.errors.name.join(", ")}</FieldError>
                ) : null}
              </Field>
              <Field>
                <Button type="submit" disabled={profilePending}>
                  <Camera className="size-4" />
                  保存账户信息
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
