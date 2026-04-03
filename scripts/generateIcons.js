// scripts/generateIcons.js
// Run: node scripts/generateIcons.js
// Requires: npm install sharp

const sharp = require("sharp");
const { mkdirSync } = require("fs");
const { join } = require("path");

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Customer icons — from pacak-khemah.png
const CUSTOMER_SOURCE = join(__dirname, "../public/pacak-khemah.png");
const CUSTOMER_OUT = join(__dirname, "../public/icons");

// Vendor icons — from vendor-logo.png
const VENDOR_SOURCE = join(__dirname, "../public/vendor-logo.png");
const VENDOR_OUT = join(__dirname, "../public/icons/vendor");

mkdirSync(CUSTOMER_OUT, { recursive: true });
mkdirSync(VENDOR_OUT, { recursive: true });

(async () => {
  console.log("📦 Generating customer icons...");
  for (const size of SIZES) {
    await sharp(CUSTOMER_SOURCE)
      .resize(size, size, { fit: "contain", background: { r: 6, g: 44, b: 36, alpha: 1 } })
      .png()
      .toFile(join(CUSTOMER_OUT, `icon-${size}x${size}.png`));
    console.log(`  ✅ icons/icon-${size}x${size}.png`);
  }

  console.log("\n📦 Generating vendor icons...");
  for (const size of SIZES) {
    await sharp(VENDOR_SOURCE)
      .resize(size, size, { fit: "contain", background: { r: 6, g: 44, b: 36, alpha: 1 } })
      .png()
      .toFile(join(VENDOR_OUT, `icon-${size}x${size}.png`));
    console.log(`  ✅ icons/vendor/icon-${size}x${size}.png`);
  }

  console.log("\n🎉 All icons generated!");
})();