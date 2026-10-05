"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormMessage } from "@/components/ui/form";
import { ID_TYPE_LABEL, ID_TYPES, type IdType } from "@/lib/pg";

const select =
  "mt-1 block min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base focus:border-brand-600 focus:outline-none";
const label = "block text-sm font-medium text-stone-700";

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Turns any phone photo into a ~1280px JPEG before upload (usually
 * 150–300 KB), so ID photos take little of the storage allowance and
 * upload quickly on mobile data. Still readable for an ID card.
 */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; // transparent PNGs become white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const jpeg = (q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    let blob = await jpeg(0.7);
    if (blob && blob.size > 500 * 1024) blob = await jpeg(0.5);
    return blob ?? file;
  } catch {
    return file; // a format the browser can't decode: the size check and server decide
  }
}

export function IdPhotoUpload({
  customerId,
  defaultType,
}: {
  customerId: string;
  defaultType: IdType | null;
}) {
  const router = useRouter();
  const [docType, setDocType] = useState<IdType>(defaultType ?? "AADHAAR");
  const [side, setSide] = useState("FRONT");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const blob = await shrink(file);
      // Checked again on the server; refusing here saves a big upload on mobile data.
      if (blob.size > MAX_BYTES) {
        setMessage({ ok: false, text: "The photo must be under 2 MB." });
        return;
      }
      const body = new FormData();
      body.set("customerId", customerId);
      body.set("docType", docType);
      body.set("side", side);
      body.set("file", blob, blob === file ? file.name : "id.jpg");
      const res = await fetch("/api/id-photos", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setMessage({ ok: false, text: json.error ?? "Couldn't upload." });
      else {
        setMessage({ ok: true, text: "Photo saved." });
        router.refresh();
      }
    } catch {
      setMessage({ ok: false, text: "Couldn't upload. Check the connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="id-upload">
      {message && <FormMessage tone={message.ok ? "success" : "error"}>{message.text}</FormMessage>}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="docType" className={label}>
            ID type
          </label>
          <select
            id="docType"
            value={docType}
            onChange={(e) => setDocType(e.target.value as IdType)}
            className={select}
          >
            {ID_TYPES.map((t) => (
              <option key={t} value={t}>
                {ID_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="docSide" className={label}>
            Side
          </label>
          <select
            id="docSide"
            value={side}
            onChange={(e) => setSide(e.target.value)}
            className={select}
          >
            <option value="FRONT">Front</option>
            <option value="BACK">Back</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>
      <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-dashed border-stone-400 bg-stone-50 px-4 font-medium text-stone-800">
        {busy ? "Uploading…" : "Take or choose ID photo"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          aria-label="ID photo"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
      </label>
      <p className="text-xs text-stone-500">
        Stored privately. Only your business can see it. Don’t write the ID number anywhere else.
      </p>
    </div>
  );
}
