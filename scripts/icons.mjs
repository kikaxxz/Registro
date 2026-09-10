import sharp from "sharp";
import { mkdir } from "node:fs/promises";
await mkdir("public/icons", { recursive: true });
for (const size of [192, 512, 180]) {
  await sharp("public/icon.svg")
    .resize(size, size)
    .png()
    .toFile(
      `public/icons/${size === 180 ? "apple-touch-icon" : `icon-${size}`}.png`,
    );
}
const safeIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#172522"/><path d="m280 115-110 158h81l-13 124 115-174h-78z" fill="#d7f45c"/></svg>';
await sharp(Buffer.from(safeIcon))
  .png()
  .toFile("public/icons/maskable-512.png");
