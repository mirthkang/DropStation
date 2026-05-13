import { notFound, redirect } from "next/navigation";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSession } from "@/library/session";
import { getUserById } from "@/library/server/users";

export default async function AdminPage() {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/signin");
  }

  const user = await getUserById(session.userId);

  if (!user) {
    redirect("/signin");
  }

  if (!user.isAdmin) {
    notFound();
  }

  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">后台管理</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          管理功能会在后续版本中逐步补全。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>功能未完成</CardTitle>
          <CardDescription>
            后台管理入口已预留，目前还没有可用功能。
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
