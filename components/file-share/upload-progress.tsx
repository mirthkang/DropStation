import { Button } from "@/components/ui/button";
import type { UploadStatus } from "@/components/file-share/upload-xhr";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSecond: number) {
  if (bytesPerSecond <= 0) return "计算中";

  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "计算中";

  const rounded = Math.max(0, Math.ceil(seconds));

  if (rounded < 60) return `${rounded} 秒`;

  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes} 分 ${remainingSeconds} 秒` : `${minutes} 分`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours} 小时 ${remainingMinutes} 分` : `${hours} 小时`;
}

export function UploadProgress({
  status,
  onCancel,
}: {
  status: UploadStatus;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="font-medium">
          {status.phase === "processing" ? "服务端处理中" : "正在上传"}
        </div>
        <div className="text-muted-foreground">{status.progress}%</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${status.progress}%` }}
        />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <div>
          {formatBytes(status.loaded)} / {formatBytes(status.total)}
        </div>
        <div>速度 {formatSpeed(status.speedBytesPerSecond)}</div>
        <div>剩余 {formatDuration(status.remainingSeconds)}</div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {status.phase === "processing"
            ? "文件已上传完成，正在保存并生成分享链接。"
            : "请保持页面打开，上传过程中可以取消。"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={status.phase === "processing"}
        >
          取消上传
        </Button>
      </div>
    </div>
  );
}
