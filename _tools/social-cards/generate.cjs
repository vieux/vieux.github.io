#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { chromium } = require("playwright");

const toolDir = __dirname;
const siteDir = path.resolve(toolDir, "../..");
const cards = JSON.parse(fs.readFileSync(path.join(toolDir, "cards.json"), "utf8"));

function parseArgs(argv) {
  const options = { card: null, outputDir: siteDir };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--card") options.card = argv[++index];
    else if (argument === "--output-dir") options.outputDir = path.resolve(argv[++index]);
    else if (argument === "--help") {
      console.log("Usage: npm run generate -- [--card slug] [--output-dir path]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function resolveImage(source) {
  const absolutePath = path.resolve(siteDir, source);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing source image: ${absolutePath}`);
  }
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  };
  const mimeType = mimeTypes[path.extname(absolutePath).toLowerCase()];
  if (!mimeType) throw new Error(`Unsupported image format: ${absolutePath}`);
  const contents = fs.readFileSync(absolutePath).toString("base64");
  return `data:${mimeType};base64,${contents}`;
}

function imageMarkup(card) {
  const images = card.images.map(resolveImage);
  if (card.layout === "phone") {
    return `<div class="visual phone"><img src="${images[0]}" alt=""></div>`;
  }
  if (card.layout === "windows") {
    return `<div class="visual window-one"><img src="${images[0]}" alt=""></div>
      <div class="visual window-two"><img src="${images[1]}" alt=""></div>`;
  }
  if (card.layout === "game") {
    return `<div class="visual game"><img src="${images[0]}" alt=""></div>`;
  }
  return `<div class="visual hero"><img src="${images[0]}" alt=""></div>`;
}

function documentFor(card) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    html, body { width: 1200px; height: 627px; margin: 0; overflow: hidden; background: #222; }
    body { font-family: Menlo, Monaco, "Courier New", monospace; }
    .card { position: relative; width: 1200px; height: 627px; overflow: hidden; background: #222; color: #fff; }
    .copy { position: absolute; z-index: 3; top: 72px; left: 72px; width: 650px; }
    .site { margin: 0 0 28px; color: #66b3ff; font-size: 24px; font-weight: 600; }
    h1 { margin: 0; font-size: 54px; line-height: 1.12; letter-spacing: -2px; }
    .subtitle { max-width: 630px; margin: 30px 0 0; color: #ccc; font-size: 24px; line-height: 1.45; }
    .accent { position: absolute; z-index: 4; bottom: 54px; left: 72px; width: 96px; height: 6px; background: #66b3ff; }
    .visual { position: absolute; z-index: 1; }
    .phone { right: 85px; bottom: -360px; width: 330px; padding: 13px; border: 2px solid #777; border-radius: 34px; background: #111; box-shadow: 0 30px 70px rgba(0,0,0,.55); transform: rotate(4deg); }
    .phone img { display: block; width: 100%; border-radius: 22px; }
    .window-one { right: 55px; top: 67px; width: 405px; padding: 10px; border: 1px solid #777; border-radius: 12px; background: #eee; box-shadow: 0 24px 70px rgba(0,0,0,.6); transform: rotate(3deg); }
    .window-one img { display: block; width: 100%; }
    .window-two { right: 100px; bottom: -315px; width: 225px; padding: 9px; border: 1px solid #777; border-radius: 12px; background: #eee; box-shadow: 0 24px 70px rgba(0,0,0,.6); transform: rotate(-4deg); }
    .window-two img { display: block; width: 100%; }
    .game { right: -110px; bottom: -32px; width: 600px; border: 2px solid #777; border-radius: 16px; box-shadow: 0 30px 80px rgba(0,0,0,.7); transform: rotate(-3deg); }
    .game img { display: block; width: 100%; border-radius: 14px; }
    .hero { right: -40px; top: 80px; width: 500px; max-height: 500px; padding: 10px; border: 1px solid #777; border-radius: 16px; background: #111; box-shadow: 0 30px 80px rgba(0,0,0,.7); transform: rotate(-2deg); }
    .hero img { display: block; width: 100%; max-height: 480px; object-fit: cover; border-radius: 10px; }
    .shade { position: absolute; z-index: 2; inset: 0; background: linear-gradient(90deg, #222 0%, #222 53%, rgba(34,34,34,.74) 68%, rgba(34,34,34,.08) 100%); }
    .phone-card .copy { width: 690px; }
    .windows-card .copy { width: 700px; }
    .game-card .copy { width: 670px; }
  </style>
</head>
<body>
  <section class="card ${escapeHtml(card.layout)}-card">
    <div class="copy">
      <p class="site">vieux.fr</p>
      <h1>${escapeHtml(card.title)}</h1>
      <p class="subtitle">${escapeHtml(card.subtitle)}</p>
    </div>
    ${imageMarkup(card)}
    ${card.layout === "phone" ? "" : '<div class="shade"></div>'}
    <div class="accent"></div>
  </section>
</body>
</html>`;
}

function systemChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find(fs.existsSync);
}

function optimizePng(filePath) {
  const available = spawnSync("magick", ["-version"], { stdio: "ignore" }).status === 0;
  if (!available) return;
  const temporary = path.join(os.tmpdir(), `social-card-${process.pid}.png`);
  const result = spawnSync("magick", [filePath, "-strip", "-define", "png:compression-level=9", temporary], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`ImageMagick failed for ${filePath}`);
  fs.renameSync(temporary, filePath);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const selected = options.card ? cards.filter((card) => card.slug === options.card) : cards;
  if (!selected.length) throw new Error(`Unknown card slug: ${options.card}`);

  const executablePath = systemChrome();
  const browser = await chromium.launch(executablePath ? { headless: true, executablePath } : { headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 627 }, deviceScaleFactor: 1 });

  try {
    for (const card of selected) {
      await page.setContent(documentFor(card), { waitUntil: "load" });
      await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
      const outputPath = path.join(options.outputDir, card.slug, "social-card.png");
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      await page.screenshot({ path: outputPath });
      optimizePng(outputPath);
      console.log(path.relative(siteDir, outputPath));
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
