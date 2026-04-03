// scripts/generateIcons.js
// Run: node scripts/generateIcons.js
// Requires: npm install sharp

const sharp = require("sharp");
const { mkdirSync } = require("fs");
const { join } = require("path");

const SOURCE = join(__dirname, "../public/pacak-khemah.png");
const OUT_DIR = join(__dirname, "../public/icons");

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  for (const size of SIZES) {
    await sharp(SOURCE)
      .resize(size, size, { fit: "contain", background: { r: 6, g: 44, b: 36, alpha: 1 } })
      .png()
      .toFile(join(OUT_DIR, `icon-${size}x${size}.png`));
    console.log(`✅ icon-${size}x${size}.png`);
  }
  console.log("\n🎉 All icons generated in public/icons/");
})();