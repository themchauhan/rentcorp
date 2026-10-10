"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormMessage } from "@/components/ui/form";
import { shrinkPhoto } from "@/lib/shrink-photo";

const PDF_MAX = 5 * 1024 * 1024;
const PHOTO_MAX = 2 * 1024 * 1024;

/** Upload or replace the signed agreement: a PDF, or a photo (shrunk first). */
export function AgreementUpload({
  agreementId,
  hasDocument,
}: {
  agreementId: string;
  hasDocument: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const isPdf = file.type === "application/pdf";
      // Agreements are text: keep photos sharper than ID photos.
      const blob = isPdf ? file : await shrinkPhoto(file, 2000);
      const max = isPdf ? PDF_MAX : PHOTO_MAX;
      if (blob.size > max) {
        setMessage({ ok: false, text: `The file must be under ${isPdf ? "5" : "2"} MB.` });
        return;
      }
      const body = new FormData();
      body.set("file", blob, isPdf ? file.name : "agreement.jpg");
      const res = await fetch(`/api/agreements/${agreementId}/document`, { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setMessage({ ok: false, text: json.error ?? "Couldn't upload." });
      else {
        setMessage({ ok: true, text: "Agreement saved." });
        router.refresh();
      }
    } catch {
      setMessage({ ok: false, text: "Couldn't upload. Check the connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2" data-testid="agreement-upload">
      {message && <FormMessage tone={message.ok ? "success" : "error"}>{message.text}</FormMessage>}
      <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-dashed border-stone-400 bg-stone-50 px-4 font-medium text-stone-800">
        {busy ? "Uploading…" : hasDocument ? "Replace signed agreement" : "Upload signed agreement"}
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Agreement file"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
      </label>
      <p className="text-xs text-stone-500">PDF up to 5 MB, or a photo. Stored privately.</p>
    </div>
  );
}
