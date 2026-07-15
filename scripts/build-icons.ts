/**
 * Renders the reader logo SVG into the icon.iconset folder electrobun's
 * macOS build consumes (converted to .icns via iconutil at build time),
 * plus a single icon.png for the Linux desktop entry.
 *
 * Usage: bun run scripts/build-icons.ts
 */
import { Resvg } from "@resvg/resvg-js";

const SVG_PATH = "src/webview/app/assets/reader-logo.svg";
const ICONSET_DIR = "icon.iconset";
const LINUX_ICON = "icon.png";

// macOS icons read better with breathing room: render the artwork at ~80%
// of the canvas, centered, transparent background.
const ARTWORK_RATIO = 0.8;

// resvg rejects the file's iso-8859-1 XML declaration; the content is ASCII.
const svg = (await Bun.file(SVG_PATH).text()).replace(/<\?xml[\s\S]*?\?>/, "").trimStart();

async function renderPng(size: number, outPath: string): Promise<void> {
  const artworkSize = Math.round(size * ARTWORK_RATIO);
  const rendered = new Resvg(svg, {
    fitTo: { mode: "width", value: artworkSize },
  }).render();

  const offset = Math.round((size - rendered.width) / 2);
  const art = rendered.asPng();

  // Compose onto a transparent square canvas via a wrapper SVG so we don't
  // need a raster graphics dependency.
  const wrapper = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <image href="data:image/png;base64,${Buffer.from(art).toString("base64")}" x="${offset}" y="${Math.round((size - rendered.height) / 2)}" width="${rendered.width}" height="${rendered.height}"/>
  </svg>`;
  const composed = new Resvg(wrapper, { fitTo: { mode: "width", value: size } }).render();
  await Bun.write(outPath, composed.asPng());
}

const sizes = [16, 32, 128, 256, 512];
for (const size of sizes) {
  await renderPng(size, `${ICONSET_DIR}/icon_${size}x${size}.png`);
  await renderPng(size * 2, `${ICONSET_DIR}/icon_${size}x${size}@2x.png`);
}
await renderPng(512, LINUX_ICON);

console.log(`wrote ${sizes.length * 2} iconset entries + ${LINUX_ICON}`);
