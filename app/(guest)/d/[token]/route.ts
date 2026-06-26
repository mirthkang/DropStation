import { Readable } from "node:stream";

import {
  contentDispositionForDownload,
  deleteSharedFile,
  getSharedFile,
  openSharedFile,
  recordSharedFileDownload,
} from "@/library/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailableResponse() {
  return new Response("链接不可用：文件不存在、已过期，或对应文件已经被清理。", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const sharedFile = await getSharedFile(token);

  if (!sharedFile) {
    return unavailableResponse();
  }

  try {
    const { size, stream } = await openSharedFile(sharedFile);
    await recordSharedFileDownload(sharedFile);

    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Length": String(size),
        "Content-Type": sharedFile.mimeType,
        "Content-Disposition": contentDispositionForDownload(sharedFile.originalName),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    await deleteSharedFile(sharedFile);
    return unavailableResponse();
  }
}
