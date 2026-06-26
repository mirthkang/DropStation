import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { headers } from "next/headers";
import Link from "next/link";
import {
  Activity,
  ArrowDownUp,
  Clock,
  Database,
  Download,
  ExternalLink,
  FileWarning,
  Search,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react";

import {
  adminCleanupExpiredFilesAction,
  adminDeleteShareAction,
} from "@/library/actions/admin";
import { requireAdminUser } from "@/library/server/admin";
import {
  type AdminShareRecord,
  createDownloadUrlFromHeaders,
  getAdminDashboardStats,
  getAdminSharedFiles,
  getRecentUploads,
} from "@/library/server/storage";
import { cn } from "@/library/utils";
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

type AdminPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sort?: string;
  }>;
};

const statusLabels = {
  active: "有效",
  expired: "已过期",
  missing: "文件丢失",
} satisfies Record<AdminShareRecord["status"], string>;

const statusClasses = {
  active: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  expired: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  missing: "border-destructive/25 bg-destructive/10 text-destructive",
} satisfies Record<AdminShareRecord["status"], string>;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(value: number | null) {
  if (!value) return "暂无";

  return format(new Date(value), "yyyy-MM-dd HH:mm", { locale: zhCN });
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
        <CardAction>
          <Icon className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function ShareStatusBadge({ status }: { status: AdminShareRecord["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium",
        statusClasses[status]
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

function OwnerLabel({ share }: { share: AdminShareRecord }) {
  if (!share.ownerUsername) {
    return <span>游客</span>;
  }

  return (
    <span>
      {share.ownerName || share.ownerUsername}
      <span className="text-muted-foreground"> @{share.ownerUsername}</span>
    </span>
  );
}

function ShareCard({
  share,
  url,
}: {
  share: AdminShareRecord;
  url: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="min-w-0 truncate">{share.originalName}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ShareStatusBadge status={share.status} />
          <span>{formatBytes(share.size)}</span>
          <span>上传者：<OwnerLabel share={share} /></span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div>Token</div>
            <div className="mt-1 font-mono text-foreground">{share.token}</div>
          </div>
          <div>
            <div>创建时间</div>
            <div className="mt-1 text-foreground">{formatDate(share.createdAt)}</div>
          </div>
          <div>
            <div>过期时间</div>
            <div className="mt-1 text-foreground">{formatDate(share.expiresAt)}</div>
          </div>
          <div>
            <div>下载</div>
            <div className="mt-1 text-foreground">
              {share.downloadCount} 次 · {formatDate(share.lastDownloadedAt)}
            </div>
          </div>
        </div>

        <details className="rounded-lg border bg-muted/30 p-3 text-xs">
          <summary className="cursor-pointer font-medium text-foreground">文件详情</summary>
          <dl className="mt-3 grid gap-2 text-muted-foreground sm:grid-cols-2">
            <div>
              <dt>MIME</dt>
              <dd className="mt-1 break-all text-foreground">{share.mimeType}</dd>
            </div>
            <div>
              <dt>存储文件</dt>
              <dd className="mt-1 break-all font-mono text-foreground">{share.storedName}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt>SHA-256</dt>
              <dd className="mt-1 break-all font-mono text-foreground">{share.sha256}</dd>
            </div>
          </dl>
        </details>

        <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 break-all text-sm text-muted-foreground">{url}</p>
          <div className="flex shrink-0 gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href={url} target="_blank" />}
            >
              <ExternalLink className="size-4" />
              打开
            </Button>
            <form action={adminDeleteShareAction}>
              <input type="hidden" name="token" value={share.token} />
              <Button type="submit" variant="destructive">
                <Trash2 className="size-4" />
                删除
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  await requireAdminUser();

  const query = await searchParams;
  const q = firstSearchParam(query.q)?.trim() ?? "";
  const status = firstSearchParam(query.status) ?? "all";
  const sort = firstSearchParam(query.sort) ?? "created_desc";

  const [stats, recentUploads, shares, headersList] = await Promise.all([
    getAdminDashboardStats(),
    getRecentUploads(5),
    getAdminSharedFiles({
      query: q,
      status:
        status === "active" || status === "expired" || status === "missing"
          ? status
          : "all",
      sort:
        sort === "created_asc" ||
        sort === "expires_asc" ||
        sort === "expires_desc" ||
        sort === "size_desc"
          ? sort
          : "created_desc",
      limit: 50,
    }),
    headers(),
  ]);

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">后台管理</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            查看系统状态、管理分享链接，并处理过期文件。
          </p>
        </div>
        <form action={adminCleanupExpiredFilesAction}>
          <Button type="submit" variant="outline">
            <FileWarning className="size-4" />
            清理过期文件
          </Button>
        </form>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="文件总数"
          value={String(stats.totalFiles)}
          description={`有效 ${stats.activeFiles}，过期 ${stats.expiredFiles}`}
          icon={Database}
        />
        <StatCard
          title="存储占用"
          value={formatBytes(stats.totalBytes)}
          description={`${stats.expiringSoonFiles} 个文件将在 24 小时内过期`}
          icon={Activity}
        />
        <StatCard
          title="今日上传"
          value={String(stats.todayUploads)}
          description={`今日下载 ${stats.todayDownloads} 次`}
          icon={UploadCloud}
        />
        <StatCard
          title="用户数量"
          value={String(stats.totalUsers)}
          description="包含管理员和普通用户"
          icon={Users}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">分享管理</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                当前显示最多 50 条记录。
              </p>
            </div>
          </div>

          <form className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_140px_160px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="搜索文件名、token、上传者"
                className="pl-8"
              />
            </div>
            <select
              name="status"
              defaultValue={status}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="all">全部状态</option>
              <option value="active">有效</option>
              <option value="expired">已过期</option>
              <option value="missing">文件丢失</option>
            </select>
            <select
              name="sort"
              defaultValue={sort}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="created_desc">创建时间从新到旧</option>
              <option value="created_asc">创建时间从旧到新</option>
              <option value="expires_asc">过期时间从近到远</option>
              <option value="expires_desc">过期时间从远到近</option>
              <option value="size_desc">文件从大到小</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 sm:flex-none">
                <Search className="size-4" />
                查询
              </Button>
              <Button
                nativeButton={false}
                variant="outline"
                render={<Link href="/admin" />}
              >
                重置
              </Button>
            </div>
          </form>

          {shares.length > 0 ? (
            <div className="space-y-3">
              {shares.map((share) => (
                <ShareCard
                  key={share.token}
                  share={share}
                  url={createDownloadUrlFromHeaders(headersList, share.token)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>没有匹配的分享</CardTitle>
                <CardDescription>换一个关键词或筛选条件再试。</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                最近上传
              </CardTitle>
              <CardDescription>按创建时间展示最新 5 条。</CardDescription>
            </CardHeader>
            <CardContent>
              {recentUploads.length > 0 ? (
                <div className="space-y-3">
                  {recentUploads.map((share) => (
                    <div key={share.token} className="border-b pb-3 last:border-b-0 last:pb-0">
                      <div className="truncate text-sm font-medium">{share.originalName}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <ShareStatusBadge status={share.status} />
                        <span>{formatBytes(share.size)}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDate(share.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无上传记录。</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownUp className="size-4 text-muted-foreground" />
                下载统计
              </CardTitle>
              <CardDescription>下载次数会在文件成功打开后记录。</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">今日下载</div>
                <div className="mt-1 text-lg font-semibold">{stats.todayDownloads}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">全部分享</div>
                <div className="mt-1 text-lg font-semibold">{stats.totalFiles}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="size-4 text-muted-foreground" />
                清理状态
              </CardTitle>
              <CardDescription>过期文件也会在上传、下载和列表查询时自动清理。</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">已过期</div>
                <div className="mt-1 text-lg font-semibold">{stats.expiredFiles}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">即将过期</div>
                <div className="mt-1 text-lg font-semibold">{stats.expiringSoonFiles}</div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </>
  );
}
