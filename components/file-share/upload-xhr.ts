export type UploadResult = {
  url: string;
  duplicate: boolean;
  file: {
    token: string;
    name: string;
    size: number;
    expiresAt: number;
    sha256: string;
  };
};

export type UploadStatus = {
  phase: "uploading" | "processing";
  progress: number;
  loaded: number;
  total: number;
  speedBytesPerSecond: number;
  remainingSeconds: number | null;
};

export function uploadWithProgress(
  formData: FormData,
  totalBytes: number,
  onProgress: (status: UploadStatus) => void
) {
  const xhr = new XMLHttpRequest();
  const startedAt = Date.now();
  const promise = new Promise<UploadResult>((resolve, reject) => {
    xhr.open("POST", "/api/upload");
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001);
      const speedBytesPerSecond = event.loaded / elapsedSeconds;
      const remainingBytes = Math.max(event.total - event.loaded, 0);

      onProgress({
        phase: event.loaded >= event.total ? "processing" : "uploading",
        progress: Math.round((event.loaded / event.total) * 100),
        loaded: event.loaded,
        total: event.total,
        speedBytesPerSecond,
        remainingSeconds:
          speedBytesPerSecond > 0 ? remainingBytes / speedBytesPerSecond : null,
      });
    };

    xhr.upload.onload = () => {
      onProgress({
        phase: "processing",
        progress: 100,
        loaded: totalBytes,
        total: totalBytes,
        speedBytesPerSecond: 0,
        remainingSeconds: 0,
      });
    };

    xhr.onload = () => {
      const payload = xhr.response ?? JSON.parse(xhr.responseText || "{}");

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload as UploadResult);
        return;
      }

      reject(new Error(payload?.error || "上传失败"));
    };

    xhr.onerror = () => reject(new Error("网络错误，上传失败"));
    xhr.onabort = () => reject(new Error("上传已取消"));
    xhr.send(formData);
  });

  return { xhr, promise };
}
