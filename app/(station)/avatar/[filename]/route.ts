import { Readable } from "node:stream";

import { getSession } from "@/library/session";
import { openAvatar } from "@/library/server/storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const session = await getSession();

  if (!session?.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { filename } = await context.params;
  const avatar = await openAvatar(filename);

  if (!avatar) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(Readable.toWeb(avatar.stream) as ReadableStream, {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Length": avatar.size.toString(),
      "Content-Type": avatar.contentType,
    },
  });
}
