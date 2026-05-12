import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function NotFound() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-muted/40 px-4 py-10">
      <Empty className="w-full max-w-md flex-none border bg-card p-8 shadow-sm">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-12">
            <AlertTriangle className="size-5" />
          </EmptyMedia>
          <p className="text-sm font-medium text-muted-foreground">DropStation</p>
          <EmptyTitle className="text-2xl">页面不存在</EmptyTitle>
        </EmptyHeader>
        <EmptyDescription>你访问的页面不存在，或链接已经失效。</EmptyDescription>
        <EmptyContent>
          <Link href="/" className={buttonVariants()}>返回首页</Link>
        </EmptyContent>
      </Empty>
    </main>
  );
}
