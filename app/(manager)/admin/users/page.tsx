import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  KeyRound,
  Lock,
  LockOpen,
  Plus,
  ShieldCheck,
  UploadCloud,
  UserCog,
  Users,
} from "lucide-react";

import {
  adminCreateUserAction,
  adminResetUserPasswordAction,
  adminSetPublicRegistrationAction,
  adminSetUserDisabledAction,
} from "@/library/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdminUser } from "@/library/server/admin";
import { isPublicRegistrationEnabled } from "@/library/server/settings";
import { type AdminUserRecord, getAdminUsers } from "@/library/server/users";
import { cn } from "@/library/utils";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(value: number | null) {
  if (!value) return "从未登录";

  return format(new Date(value), "yyyy-MM-dd HH:mm", { locale: zhCN });
}

function UserStatusBadge({ user }: { user: AdminUserRecord }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium",
        user.isDisabled
          ? "border-destructive/25 bg-destructive/10 text-destructive"
          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      )}
    >
      {user.isDisabled ? "已禁用" : "启用中"}
    </span>
  );
}

function UserCard({
  user,
  currentUserId,
}: {
  user: AdminUserRecord;
  currentUserId: number;
}) {
  const isCurrentUser = user.id === currentUserId;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate">{user.name}</span>
          <span className="font-mono text-sm text-muted-foreground">@{user.username}</span>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <UserStatusBadge user={user} />
          {user.isAdmin ? (
            <span className="inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs font-medium">
              <ShieldCheck className="size-3" />
              管理员
            </span>
          ) : null}
          {isCurrentUser ? <span className="text-xs text-muted-foreground">当前账号</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-4">
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground">分享数</div>
            <div className="mt-1 font-semibold">{user.shareCount}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground">存储占用</div>
            <div className="mt-1 font-semibold">{formatBytes(user.storageBytes)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground">注册时间</div>
            <div className="mt-1 font-semibold">{formatDate(user.createdAt)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground">最后登录</div>
            <div className="mt-1 font-semibold">{formatDate(user.lastLoginAt)}</div>
          </div>
        </div>

        <div className="grid gap-3 border-t pt-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <form action={adminResetUserPasswordAction} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="userId" value={user.id} />
            <Input
              name="password"
              type="password"
              minLength={6}
              placeholder="输入新密码"
              required
              className="sm:max-w-64"
            />
            <Button type="submit" variant="outline">
              <KeyRound className="size-4" />
              重置密码
            </Button>
          </form>

          <form action={adminSetUserDisabledAction}>
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="disabled" value={user.isDisabled ? "false" : "true"} />
            <Button
              type="submit"
              variant={user.isDisabled ? "outline" : "destructive"}
              disabled={isCurrentUser}
            >
              {user.isDisabled ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
              {user.isDisabled ? "启用用户" : "禁用用户"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminUsersPage() {
  const currentUser = await requireAdminUser();
  const [users, registrationEnabled] = await Promise.all([
    getAdminUsers(),
    isPublicRegistrationEnabled(),
  ]);

  const activeUsers = users.filter((user) => !user.isDisabled).length;
  const disabledUsers = users.length - activeUsers;
  const totalStorageBytes = users.reduce((total, user) => total + user.storageBytes, 0);

  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">用户管理</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          管理账号状态、创建用户、重置密码，并控制是否允许公开注册。
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">用户总数</CardTitle>
            <CardAction>
              <Users className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">{users.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              启用 {activeUsers}，禁用 {disabledUsers}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">用户分享</CardTitle>
            <CardAction>
              <UploadCloud className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {users.reduce((total, user) => total + user.shareCount, 0)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              占用 {formatBytes(totalStorageBytes)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">公开注册</CardTitle>
            <CardAction>
              <UserCog className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {registrationEnabled ? "已开启" : "已关闭"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              关闭后只能由管理员创建用户。
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>注册设置</CardTitle>
              <CardDescription>控制访客是否可以自行创建账号。</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={adminSetPublicRegistrationAction} className="flex gap-2">
                <input
                  type="hidden"
                  name="enabled"
                  value={registrationEnabled ? "false" : "true"}
                />
                <Button type="submit" variant={registrationEnabled ? "destructive" : "outline"}>
                  {registrationEnabled ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
                  {registrationEnabled ? "关闭公开注册" : "开启公开注册"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>创建用户</CardTitle>
              <CardDescription>由管理员创建的用户可以直接使用账号密码登录。</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={adminCreateUserAction} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="admin-create-name">姓名</Label>
                  <Input id="admin-create-name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-create-username">用户名</Label>
                  <Input id="admin-create-username" name="username" required minLength={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-create-password">初始密码</Label>
                  <Input
                    id="admin-create-password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full">
                  <Plus className="size-4" />
                  创建用户
                </Button>
              </form>
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-3">
          {users.map((user) => (
            <UserCard key={user.id} user={user} currentUserId={currentUser.id} />
          ))}
        </div>
      </section>
    </>
  );
}
