import { NextRequest } from "next/server";

import { createDownloadUrl, saveUpload } from "@/library/server/storage";
import { getSession } from "@/library/session";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const expiresAtValue = formData.get("expiresAt");

    if (!(file instanceof File)) {
      return Response.json({ error: "请选择要上传的文件" }, { status: 400 });
    }

    const expiresAt =
      typeof expiresAtValue === "string" ? Number(expiresAtValue) : Number.NaN;
    const session = await getSession();
    const result = await saveUpload(file, expiresAt, session?.userId ?? null);
    const url = createDownloadUrl(request, result.file.token);

    return Response.json({
      url,
      duplicate: result.duplicate,
      file: {
        token: result.file.token,
        name: result.file.originalName,
        size: result.file.size,
        expiresAt: result.file.expiresAt,
        sha256: result.file.sha256,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败，请重试";
    return Response.json({ error: message }, { status: 400 });
  }
}
