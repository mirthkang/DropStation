import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminNav } from "@/components/admin-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { deleteSession, getSession } from "@/library/session";
import { getUserById } from "@/library/server/users";

export default async function ManagerLayout({ children }: React.PropsWithChildren) {
  const session = await getSession();
  const user = session?.userId ? await getUserById(session.userId) : null;

  if (user?.isDisabled) {
    await deleteSession();
    redirect("/signin");
  }

  return (
    <main className="min-h-full flex-1 bg-muted/40">
      <nav className="border-b bg-background/95">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin" className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight">
              <Image
                src="/logo.png"
                alt=""
                width={360}
                height={240}
                className="h-8 w-auto"
                priority
              />
              <span className="hidden sm:inline">DropStation 管理</span>
            </Link>
            <AdminNav />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            {user ? <UserMenu user={user} /> : null}
            <Button nativeButton={false} variant="outline" render={<Link href="/" />}>
              <ArrowLeft className="size-4" />
              返回前台
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}
