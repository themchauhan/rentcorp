// Browser-only: turns a phone photo into a small JPEG before upload, so
// documents take little of the storage allowance and upload quickly on
// mobile data. Anything the browser can't decode is returned unchanged
// (the size check and the server decide).

export async function shrinkPhoto(file: File, maxSide = 1280): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
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
    return file;
  }
}
