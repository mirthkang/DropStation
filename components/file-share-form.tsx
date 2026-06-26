"use client";

import { format } from "date-fns";
import { Check, Copy, FileUp, Loader2, RefreshCw, UploadCloud, } from "lucide-react";
import { toast } from "sonner";

import {
  type DurationUnit,
  durationToExpiresAt,
  ExpiresAtPicker,
  maxAmountForUnit,
  maxExpiresMs,
  roundToMinute,
} from "@/components/file-share/expires-at-picker";
import { QrCodeImage } from "@/components/file-share/qr-code-image";
import { UploadProgress } from "@/components/file-share/upload-progress";
import {
  type UploadResult,
  type UploadStatus,
  uploadWithProgress,
} from "@/components/file-share/upload-xhr";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useMemo, useRef, useState } from 'react';

const maxBytes = 1024 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy path for non-HTTPS deployments.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "-9999px";
  textArea.style.left = "-9999px";
  textArea.style.opacity = "0";
  textArea.style.pointerEvents = "none";

  document.body.appendChild(textArea);

  const selection = document.getSelection();
  const selectedRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textArea.select();
  textArea.setSelectionRange(0, textArea.value.length);

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Copy command was rejected");
    }
  } finally {
    document.body.removeChild(textArea);

    if (selection && selectedRange) {
      selection.removeAllRanges();
      selection.addRange(selectedRange);
    }
  }
}

export function FileShareForm() {

  const [file, setFile] = useState<File | null>(null);
  const [durationAmount, setDurationAmount] = useState("1");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("day");
  const [expiresAtDate, setExpiresAtDate] = useState<Date>(() =>
    durationToExpiresAt(1, "day")
  );
  const [maxDate] = useState(() => new Date(Date.now() + maxExpiresMs));
  const [isUploading, setIsUploading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const uploadRequestRef = useRef<XMLHttpRequest | null>(null);

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  function updateDuration(nextAmount: string, nextUnit: DurationUnit) {
    setDurationUnit(nextUnit);

    const amount = Number(nextAmount);

    if (Number.isFinite(amount) && amount > 0) {
      const maxAmount = maxAmountForUnit(nextUnit);
      const clampedAmount = Math.min(amount, maxAmount);

      setDurationAmount(String(clampedAmount));

      if (amount > maxAmount) {
        toast.error("过期时间不能超过 30 天");
      }

      setExpiresAtDate(durationToExpiresAt(clampedAmount, nextUnit));
      if (!result?.duplicate) {
        setResult(null);
      }
      return;
    }

    setDurationAmount(nextAmount);
  }

  function updateDate(nextDate: Date | undefined) {
    if (!nextDate) return;

    const merged = new Date(nextDate);
    merged.setHours(23, 59, 0, 0);
    setExpiresAtDate(merged.getTime() > maxDate.getTime() ? roundToMinute(maxDate) : merged);
    if (!result?.duplicate) {
      setResult(null);
    }
  }

  async function copyUrl() {
    if (!result?.url) return;

    try {
      await writeClipboardText(result.url);
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败，请手动复制链接");
    }
  }

  async function regenerateUrl() {
    if (!result?.duplicate) return;

    const expiresAt = roundToMinute(expiresAtDate).getTime();

    if (expiresAt <= Date.now() || expiresAt > Date.now() + maxExpiresMs) {
      toast.error("过期时间必须精确到分钟，并且在未来 30 天内");
      return;
    }

    setIsRegenerating(true);

    try {
      const response = await fetch("/api/regenerate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: result.file.token,
          expiresAt,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "重新生成失败");
      }

      setResult(payload);
      toast.success("已重新生成链接");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重新生成失败");
    } finally {
      setIsRegenerating(false);
    }
  }

  function cancelUpload() {
    uploadRequestRef.current?.abort();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      toast.error("请选择文件");
      return;
    }

    if (file.size > maxBytes) {
      toast.error("文件最大不能超过 1GB");
      return;
    }

    const expiresAt = roundToMinute(expiresAtDate).getTime();

    if (expiresAt <= Date.now() || expiresAt > Date.now() + maxExpiresMs) {
      toast.error("过期时间必须精确到分钟，并且在未来 30 天内");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("expiresAt", String(expiresAt));

    setIsUploading(true);
    setResult(null);
    setUploadStatus({
      phase: "uploading",
      progress: 0,
      loaded: 0,
      total: file.size,
      speedBytesPerSecond: 0,
      remainingSeconds: null,
    });

    try {
      const upload = uploadWithProgress(formData, file.size, setUploadStatus);
      uploadRequestRef.current = upload.xhr;
      const payload = await upload.promise;

      setResult(payload);
      toast.success(payload.duplicate ? "已复用相同文件的链接" : "上传完成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      uploadRequestRef.current = null;
      setIsUploading(false);
      setUploadStatus(null);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form
        onSubmit={onSubmit}
        className="rounded-lg border bg-card p-5 shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">上传文件</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              单个文件最大 1GB，链接到期后不可下载。
            </p>
          </div>
          <div className="rounded-lg border bg-muted p-2 text-muted-foreground">
            <FileUp className="size-5" />
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="file">文件</Label>
            <Label
              htmlFor="file"
              className="group flex min-h-28 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-5 text-center transition-colors hover:border-primary/50 hover:bg-muted/60 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <span className="flex size-11 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
                <UploadCloud className="size-5" />
              </span>
              <span className="space-y-1">
                <span className="block text-sm font-medium text-foreground">
                  {file ? file.name : "选择或拖放文件"}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {file ? `${formatBytes(file.size)} · 最大 1GB` : "支持单文件上传，最大 1GB"}
                </span>
              </span>
              <Input
                id="file"
                type="file"
                className="sr-only"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setResult(null);
                }}
              />
            </Label>
          </div>

          <Separator />

          <ExpiresAtPicker
            durationAmount={durationAmount}
            durationUnit={durationUnit}
            expiresAtDate={expiresAtDate}
            today={today}
            maxDate={maxDate}
            onDurationChange={updateDuration}
            onDateChange={updateDate}
          />
        </div>

        <Button type="submit" size="lg" className="mt-6 w-full" disabled={isUploading}>
          {isUploading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          {isUploading ? "上传中" : "上传文件"}
        </Button>

        {uploadStatus ? (
          <UploadProgress status={uploadStatus} onCancel={cancelUpload} />
        ) : null}
      </form>

      <aside className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">分享链接</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          上传后生成下载链接。
        </p>

        {result ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border bg-muted/60 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Check className="size-4" />
                {result.duplicate ? "发现重复文件，已复用链接" : "文件已就绪"}
              </div>
              <p className="mt-2 break-all text-sm text-muted-foreground">{result.url}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">大小</div>
                <div className="mt-1 font-medium">{formatBytes(result.file.size)}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">到期</div>
                <div className="mt-1 font-medium">
                  {format(new Date(result.file.expiresAt), "MM-dd HH:mm")}
                </div>
              </div>
            </div>
            <QrCodeImage url={result.url} />
            <div className={result.duplicate ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2"}>
              {result.duplicate ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={regenerateUrl}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  重新生成
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={copyUrl}>
                <Copy className="size-4" />
                复制
              </Button>
              <a href={result.url} className={buttonVariants()}>
                下载
              </a>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            还没有生成链接
          </div>
        )}
      </aside>
    </div>
  );
}
