import { FileShareForm } from "@/components/file-share-form";

export default function Home() {
  return (
    <>
      <header>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">文件中转站</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            无需登录，上传文件后生成一个可直接下载的临时中转链接。链接到期后自动失效，最长保留 30 天。
          </p>
        </div>
      </header>

      <FileShareForm />
    </>
  );
}
