// Generates placeholder PWA icons from an inline SVG tent mark.
// Run: node scripts/generate-icons.mjs  (re-run after changing the design)
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const BRAND = "#b45309";

// `inset` shrinks the mark so it survives maskable-icon cropping.
const svg = (inset) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND}"/>
  <g transform="translate(${inset} ${inset}) scale(${(512 - inset * 2) / 512})">
    <path d="M256 96 72 400h368z" fill="#fff"/>
    <path d="M256 96v304M256 230l-70 170h140z" fill="${BRAND}" stroke="${BRAND}" stroke-width="10" stroke-linejoin="round"/>
    <rect x="56" y="396" width="400" height="20" rx="10" fill="#fff"/>
  </g>
</svg>`;

await mkdir("public/icons", { recursive: true });
const out = [
  ["public/icons/icon-192.png", 192, 40],
  ["public/icons/icon-512.png", 512, 40],
  ["public/icons/icon-maskable-512.png", 512, 100],
  ["src/app/apple-icon.png", 180, 40],
  ["src/app/icon.png", 64, 40],
];
for (const [file, size, inset] of out) {
  await sharp(Buffer.from(svg(inset)))
    .resize(size, size)
    .png()
    .toFile(file);
  console.log("wrote", file);
}
