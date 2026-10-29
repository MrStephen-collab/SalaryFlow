#!/usr/bin/env node
/**
 * Generate the SalaryFlow brand assets from the approved logo reference.
 *
 *   node scripts/brand/generate-assets.mjs --source="C:/path/to/SalaryFlow_Logo.png"
 *
 * The source is traced into real vector paths (potrace), then composed into the
 * lockup, icon, wordmark and social/PNG exports. Path data is written to
 * src/components/brand/salaryflow-paths.ts so the React logo component and the
 * standalone SVG files always share the same geometry.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import potrace from "potrace";
import pngToIco from "png-to-ico";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=")];
  }),
);
const SOURCE = args.source;
if (!SOURCE || !fs.existsSync(SOURCE)) {
  console.error("Usage: node scripts/brand/generate-assets.mjs --source=<logo.png>");
  process.exit(1);
}

const ROOT = path.resolve(import.meta.dirname, "../..");
const BRAND_DIR = path.join(ROOT, "public/brand");
const PATHS_FILE = path.join(ROOT, "src/components/brand/salaryflow-paths.ts");
fs.mkdirSync(BRAND_DIR, { recursive: true });
fs.mkdirSync(path.dirname(PATHS_FILE), { recursive: true });

const brand = {
  navy: "#102A43",
  deepNavy: "#071A2F",
  blue: "#2563EB",
  teal: "#0D9488",
  cyan: "#22D3EE",
  flowOnLight: "#0891B2",
  white: "#FFFFFF",
};

const { data, info } = await sharp(SOURCE)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const isInk = (i) => {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  return data[i + 3] > 20 && !(r > 243 && g > 243 && b > 243);
};

function inkBox(y0, y1) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      if (!isInk((y * width + x) * channels)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

const symbolBox = inkBox(0, 620);
const wordBox = inkBox(620, height);

async function maskPng(box, predicate) {
  const w = box.maxX - box.minX + 1;
  const h = box.maxY - box.minY + 1;
  const buffer = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((box.minY + y) * width + (box.minX + x)) * channels;
      const on = isInk(i) && predicate(data[i], data[i + 1], data[i + 2]);
      const value = on ? 0 : 255;
      const o = (y * w + x) * 3;
      buffer[o] = value;
      buffer[o + 1] = value;
      buffer[o + 2] = value;
    }
  }
  return sharp(buffer, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toBuffer();
}

function trace(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    potrace.trace(
      buffer,
      {
        threshold: 128,
        turdSize: 4,
        alphaMax: 1,
        optCurve: true,
        optTolerance: 0.25,
        ...options,
      },
      (error, svg) => (error ? reject(error) : resolve(svg)),
    );
  });
}

function pathData(svg) {
  return [...svg.matchAll(/<path[^>]*d="([^"]+)"/g)]
    .map((match) => match[1])
    .join(" ");
}

const symbolD = pathData(
  await trace(await maskPng(symbolBox, () => true), {
    turdSize: 6,
    optTolerance: 0.35,
  }),
);
const salaryD = pathData(
  await trace(
    await maskPng(
      wordBox,
      (r, g, b) => b > 40 && r < 90 && g < 110 && b < 170,
    ),
    { optTolerance: 0.25 },
  ),
);
const flowD = pathData(
  await trace(
    await maskPng(wordBox, (r, g, b) => g > 130 && b > 150),
    { optTolerance: 0.25 },
  ),
);

const MARK_W = symbolBox.maxX - symbolBox.minX + 2;
const MARK_H = symbolBox.maxY - symbolBox.minY + 2;
const WORD_W = wordBox.maxX - wordBox.minX + 2;
const WORD_H = wordBox.maxY - wordBox.minY + 2;

const LOCKUP = {
  width: Math.max(MARK_W, WORD_W) + 1,
  height: MARK_H + 18 + WORD_H,
  markX: Math.round((Math.max(MARK_W, WORD_W) - MARK_W) / 2) + 15,
  markY: 0,
  wordX: 1,
  wordY: MARK_H + 18,
};

const gradient = (id, indent = "    ") =>
  `${indent}<linearGradient id="${id}" x1="0" y1="${MARK_H}" x2="${MARK_W}" y2="0" gradientUnits="userSpaceOnUse">\n` +
  `${indent}  <stop offset="0" stop-color="${brand.teal}"/>\n` +
  `${indent}  <stop offset="0.5" stop-color="${brand.cyan}"/>\n` +
  `${indent}  <stop offset="1" stop-color="${brand.blue}"/>\n` +
  `${indent}</linearGradient>`;

const markPath = (fill) =>
  `<path fill="${fill}" fill-rule="evenodd" d="${symbolD}"/>`;

function iconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_W} ${MARK_H}" role="img" aria-label="SalaryFlow">
  <defs>
${gradient("sfMarkGradient")}
  </defs>
  ${markPath("url(#sfMarkGradient)")}
</svg>
`;
}

function wordmarkSvg({ salary, flow }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WORD_W} ${WORD_H}" role="img" aria-label="SalaryFlow">
  <path fill="${salary}" fill-rule="evenodd" d="${salaryD}"/>
  <path fill="${flow}" fill-rule="evenodd" d="${flowD}"/>
</svg>
`;
}

function logoSvg({ salary, flow }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOCKUP.width} ${LOCKUP.height}" role="img" aria-label="SalaryFlow">
  <defs>
${gradient("sfMarkGradient")}
  </defs>
  <g transform="translate(${LOCKUP.markX} ${LOCKUP.markY})">
    ${markPath("url(#sfMarkGradient)")}
  </g>
  <g transform="translate(${LOCKUP.wordX} ${LOCKUP.wordY})">
    <path fill="${salary}" fill-rule="evenodd" d="${salaryD}"/>
    <path fill="${flow}" fill-rule="evenodd" d="${flowD}"/>
  </g>
</svg>
`;
}

function faviconSvg({ padded = false } = {}) {
  const size = 64;
  const scale = padded ? 0.58 : 0.72;
  const markWidth = MARK_W * scale;
  const markHeight = MARK_H * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="SalaryFlow">
  <rect width="${size}" height="${size}" rx="14" fill="${brand.deepNavy}"/>
  <defs>
${gradient("sfFaviconGradient", "    ")}
  </defs>
  <g transform="translate(${(size - markWidth) / 2} ${(size - markHeight) / 2}) scale(${scale})">
    ${markPath("url(#sfFaviconGradient)")}
  </g>
</svg>
`;
}

const files = {
  "salaryflow-icon.svg": iconSvg(),
  "salaryflow-wordmark.svg": wordmarkSvg({
    salary: brand.navy,
    flow: brand.flowOnLight,
  }),
  "salaryflow-logo.svg": logoSvg({
    salary: brand.navy,
    flow: brand.flowOnLight,
  }),
  "salaryflow-logo-dark.svg": logoSvg({
    salary: brand.navy,
    flow: brand.flowOnLight,
  }),
  "salaryflow-logo-light.svg": logoSvg({
    salary: brand.white,
    flow: brand.cyan,
  }),
  "favicon.svg": faviconSvg(),
};

for (const [name, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(BRAND_DIR, name), content);
}

// Raster exports.
const png = (svg, file, width, background) => {
  const pipeline = sharp(Buffer.from(svg)).resize({ width });
  if (background) {
    return pipeline
      .flatten({ background })
      .png()
      .toFile(path.join(BRAND_DIR, file));
  }
  return pipeline.png().toFile(path.join(BRAND_DIR, file));
};

await Promise.all([
  png(files["salaryflow-logo.svg"], "salaryflow-logo.png", 1200),
  png(files["salaryflow-logo-light.svg"], "salaryflow-logo-light.png", 1200),
  png(files["salaryflow-icon.svg"], "salaryflow-icon.png", 512),
  png(files["favicon.svg"], "icon-192.png", 192, brand.deepNavy),
  png(files["favicon.svg"], "icon-512.png", 512, brand.deepNavy),
  png(files["favicon.svg"], "icon-32.png", 32, brand.deepNavy),
  png(files["favicon.svg"], "icon-16.png", 16, brand.deepNavy),
  png(files["favicon.svg"], "apple-touch-icon.png", 180, brand.deepNavy),
]);

const icoSizes = await Promise.all(
  [16, 32, 48].map((size) =>
    sharp(Buffer.from(files["favicon.svg"]))
      .resize(size, size)
      .flatten({ background: brand.deepNavy })
      .png()
      .toBuffer(),
  ),
);
fs.writeFileSync(
  path.join(ROOT, "src/app/favicon.ico"),
  await pngToIco(icoSizes),
);

// Social preview: the light lockup on a deep navy field.
const ogBackground = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs>
      <linearGradient id="og" x1="0" y1="630" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${brand.deepNavy}"/>
        <stop offset="0.6" stop-color="${brand.navy}"/>
        <stop offset="1" stop-color="#08182B"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#og)"/>
    <circle cx="230" cy="180" r="220" fill="${brand.cyan}" opacity="0.08"/>
    <circle cx="1010" cy="470" r="240" fill="${brand.teal}" opacity="0.08"/>
  </svg>`,
);
const ogLogo = await sharp(Buffer.from(files["salaryflow-logo-light.svg"]))
  .resize({ width: 600 })
  .png()
  .toBuffer();
await sharp(ogBackground)
  .composite([{ input: ogLogo, gravity: "center" }])
  .png()
  .toFile(path.join(BRAND_DIR, "og-image.png"));

fs.writeFileSync(
  PATHS_FILE,
  `// Generated by scripts/brand/generate-assets.mjs — do not edit by hand.
export const MARK_PATH = "${symbolD}";
export const WORD_SALARY_PATH = "${salaryD}";
export const WORD_FLOW_PATH = "${flowD}";

export const MARK_VIEWBOX = "0 0 ${MARK_W} ${MARK_H}";
export const MARK_WIDTH = ${MARK_W};
export const MARK_HEIGHT = ${MARK_H};

export const WORD_WIDTH = ${WORD_W};
export const WORD_HEIGHT = ${WORD_H};

export const LOCKUP_VIEWBOX = "0 0 ${LOCKUP.width} ${LOCKUP.height}";
export const LOCKUP_WIDTH = ${LOCKUP.width};
export const LOCKUP_HEIGHT = ${LOCKUP.height};
export const LOCKUP_MARK_X = ${LOCKUP.markX};
export const LOCKUP_MARK_Y = ${LOCKUP.markY};
export const LOCKUP_WORD_X = ${LOCKUP.wordX};
export const LOCKUP_WORD_Y = ${LOCKUP.wordY};
`,
);

console.log(
  JSON.stringify(
    {
      source: SOURCE,
      symbolBox,
      wordBox,
      mark: { width: MARK_W, height: MARK_H },
      wordmark: { width: WORD_W, height: WORD_H },
      lockup: LOCKUP,
      files: [
        ...Object.keys(files),
        "salaryflow-logo.png",
        "salaryflow-logo-light.png",
        "salaryflow-icon.png",
        "icon-16.png",
        "icon-32.png",
        "icon-192.png",
        "icon-512.png",
        "apple-touch-icon.png",
        "og-image.png",
        "src/app/favicon.ico",
        "src/components/brand/salaryflow-paths.ts",
      ],
    },
    null,
    2,
  ),
);
