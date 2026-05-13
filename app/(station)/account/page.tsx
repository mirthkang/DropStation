import { redirect } from "next/navigation";

import { AccountForms } from "@/components/account/account-forms";
import { getSession } from "@/library/session";
import { getUserById } from "@/library/server/users";

export default async function AccountPage() {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/signin");
  }

  const user = await getUserById(session.userId);

  if (!user) {
    redirect("/signin");
  }

  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">我的账户</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          管理账户姓名和登录密码，用户名暂不支持修改。
        </p>
      </header>

      <AccountForms user={user} />
    </>
  );
}
