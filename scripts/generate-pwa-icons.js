// One-shot icon generator for the PWA.
// Downloads the source logo, resizes to 192/512/180 px, saves to public/icons/.
//
// Run: node scripts/generate-pwa-icons.js [source-url]
//
// Default source is the brand logo on filesafe.space. Override with a CLI
// argument to use a different source.

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const https = require("https");

const DEFAULT_SOURCE =
  "https://assets.cdn.filesafe.space/0TI1hA6fSt9I7GDtcZbh/media/6a160d8c6c22e95c9eca22ee.png";

const SIZES = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-180.png", size: 180 },  // Apple touch icon
];

// Background color when padding a non-square logo (matches manifest theme_color)
const BG_COLOR = { r: 26, g: 26, b: 110, alpha: 1 };  // #1a1a6e

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return resolve(download(res.headers.location));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function main() {
  const source = process.argv[2] || DEFAULT_SOURCE;
  const outDir = path.join(__dirname, "..", "public", "icons");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log(`Downloading source: ${source}`);
  const buffer = await download(source);
  console.log(`✓ Source loaded (${(buffer.length / 1024).toFixed(1)} KB)`);

  for (const { name, size } of SIZES) {
    // Fit inside a square of given size with brand-navy background padding.
    // 'contain' preserves aspect ratio; the background fills the rest.
    await sharp(buffer)
      .resize(size, size, {
        fit: "contain",
        background: BG_COLOR,
      })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, name));
    console.log(`✓ Generated ${name}`);
  }
  console.log("Done. Commit + push.");
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
