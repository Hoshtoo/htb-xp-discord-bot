import { AttachmentBuilder } from 'discord.js';
import { Resvg } from '@resvg/resvg-js';

const RASTER_RE = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;
const SVG_RE = /\.svg(\?.*)?$/i;
const FETCH_TIMEOUT_MS = 15_000;
const RENDER_WIDTH = 256;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

/** @type {Map<string, { png: Buffer | null, at: number }>} */
const pngCache = new Map();

/**
 * Discord can't render SVG in embeds, so fetch the SVG and rasterize it to PNG.
 * @param {string} url
 * @returns {Promise<Buffer|null>}
 */
async function svgToPng(url) {
 const cached = pngCache.get(url);
 if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.png;

 let png = null;
 try {
 const res = await fetch(url, {
 headers: { Accept: 'image/svg+xml,*/*' },
 signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
 });
 if (res.ok) {
 const svg = Buffer.from(await res.arrayBuffer());
 const resvg = new Resvg(svg, {
 background: 'rgba(0,0,0,0)',
 fitTo: { mode: 'width', value: RENDER_WIDTH },
 });
 png = resvg.render().asPng();
 }
 } catch {
 png = null;
 }

 pngCache.set(url, { png, at: Date.now() });
 return png;
}

let attachmentSeq = 0;

/**
 * URL suitable for HTML <img> tags (rasterizes SVG to a data URI).
 * @param {string|null} url
 * @returns {Promise<string|null>}
 */
export async function buildDisplayImageUrl(url) {
 if (!url) return null;
 if (RASTER_RE.test(url)) return url;
 if (SVG_RE.test(url)) {
  const png = await svgToPng(url);
  return png ? `data:image/png;base64,${png.toString('base64')}` : null;
 }
 return url;
}

/**
 * Turn a resolved image URL into something Discord can render.
 *
 * - Raster URLs (PNG/JPG/GIF/WebP) are used directly.
 * - SVG URLs are fetched and rasterized to a PNG attachment.
 *
 * @param {string|null} url
 * @returns {Promise<{ url: string|null, files: AttachmentBuilder[] }>}
 */
export async function buildEmbedImage(url) {
 if (!url) return { url: null, files: [] };

 if (RASTER_RE.test(url)) return { url, files: [] };

 if (SVG_RE.test(url)) {
 const png = await svgToPng(url);
 if (!png) return { url: null, files: [] };
 const name = `thumb-${Date.now()}-${attachmentSeq++}.png`;
 const file = new AttachmentBuilder(png, { name });
 return { url: `attachment://${name}`, files: [file] };
 }

 // Unknown extension — let Discord try it directly.
 return { url, files: [] };
}
