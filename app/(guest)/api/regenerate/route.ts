import { NextRequest } from "next/server";

import { createDownloadUrl, regenerateSharedFile } from "@/library/server/storage";
import { getSession } from "@/library/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const token = typeof payload.token === "string" ? payload.token : "";
    const expiresAt = Number(payload.expiresAt);

    if (!token) {
      return Response.json({ error: "缺少原链接信息" }, { status: 400 });
    }

    const session = await getSession();
    const file = await regenerateSharedFile(token, expiresAt, session?.userId ?? null);
    const url = createDownloadUrl(request, file.token);

    return Response.json({
      url,
      duplicate: false,
      file: {
        token: file.token,
        name: file.originalName,
        size: file.size,
        expiresAt: file.expiresAt,
        sha256: file.sha256,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "重新生成失败，请重试";
    return Response.json({ error: message }, { status: 400 });
  }
}
