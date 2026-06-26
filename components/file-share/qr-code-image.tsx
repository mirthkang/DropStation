import { Loader2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

type QrCodeState = {
  sourceUrl: string;
  imageUrl: string;
};

export function QrCodeImage({ url }: { url: string }) {
  const [qrCode, setQrCode] = useState<QrCodeState | null>(null);

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    })
      .then((imageUrl) => {
        if (!cancelled) {
          setQrCode({ sourceUrl: url, imageUrl });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrCode({ sourceUrl: url, imageUrl: "" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="rounded-lg border bg-background p-2">
      <div className="mx-auto flex aspect-square w-full max-w-40 items-center justify-center rounded-md bg-white">
        {qrCode?.sourceUrl === url && qrCode.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrCode.imageUrl} alt="分享链接二维码" className="h-full w-full select-auto" />
        ) : (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
