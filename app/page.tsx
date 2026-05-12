import { FileShareForm } from "@/components/file-share-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="min-h-full flex-1 bg-muted/40">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">DropStation</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">文件中转站</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              无需登录，上传文件后生成一个可直接下载的临时中转链接。文件保存在本机项目目录，最多保留 30 天。
            </p>
          </div>
          <ThemeToggle />
        </header>

        <FileShareForm />
      </div>
    </main>
  );
}
