import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { deleteShareAction } from "@/library/actions/shares";
import { getSession } from "@/library/session";
import {
  createDownloadUrlFromHeaders,
  getSharedFilesByOwner,
} from "@/library/server/storage";
import { getUserById } from "@/library/server/users";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default async function SharesPage() {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/signin");
  }

  const [user, shares, headersList] = await Promise.all([
    getUserById(session.userId),
    getSharedFilesByOwner(session.userId),
    headers(),
  ]);

  if (!user) {
    redirect("/signin");
  }

  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">我的分享</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          查看当前账号创建的分享链接，并删除不再需要的分享。
        </p>
      </header>

      {shares.length > 0 ? (
        <div className="space-y-3">
          {shares.map((share) => {
            const url = createDownloadUrlFromHeaders(headersList, share.token);

            return (
              <Card key={share.token} size="sm">
                <CardHeader>
                  <CardTitle className="truncate">{share.originalName}</CardTitle>
                  <CardDescription>
                    {formatBytes(share.size)} · 到期{" "}
                    {format(new Date(share.expiresAt), "yyyy年MM月dd日 HH:mm", {
                      locale: zhCN,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 break-all text-sm text-muted-foreground">
                    {url}
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      nativeButton={false}
                      variant="outline"
                      render={<Link href={url} target="_blank" />}
                    >
                      <ExternalLink className="size-4" />
                      打开
                    </Button>
                    <form action={deleteShareAction}>
                      <input type="hidden" name="token" value={share.token} />
                      <Button type="submit" variant="destructive">
                        <Trash2 className="size-4" />
                        删除
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UploadCloud className="size-4" />
            </EmptyMedia>
            <EmptyTitle>还没有分享</EmptyTitle>
            <EmptyDescription>
              登录后创建的分享会显示在这里。
            </EmptyDescription>
          </EmptyHeader>
          <Button nativeButton={false} render={<Link href="/" />}>
            去上传文件
          </Button>
        </Empty>
      )}
    </>
  );
}
