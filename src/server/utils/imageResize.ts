import { createJimp } from '@jimp/core';
import { defaultFormats, defaultPlugins } from 'jimp';
import webp from '@jimp/wasm-webp';

// Custom Jimp instance with WebP support
const Jimp = createJimp({
  formats: [...defaultFormats, webp],
  plugins: defaultPlugins,
});

/** Claude API recommends ≤1568px on both sides; larger images are auto-shrunk by the API, wasting bandwidth and TTFT. */
const MAX_DIMENSION = 1568;
/** Max dimension for MCP tool result images. Aligned with API recommendation. */
const MAX_TOOL_IMAGE_DIMENSION = 1568;

type ImagePayload = { name: string; mimeType: string; data: string };

/** MCP protocol image content block */
type McpImageContent = { type: 'image'; data: string; mimeType: string };
/** MCP protocol text content block */
type McpTextContent = { type: 'text'; text: string };
/** MCP tool result content block (subset of MCP protocol types) */
type McpContentBlock = McpImageContent | McpTextContent | { type: string; [key: string]: unknown };

export async function resizeImageIfNeeded(img: ImagePayload): Promise<ImagePayload> {
  try {
    const buffer = Buffer.from(img.data, 'base64');
    const image = await Jimp.fromBuffer(buffer);
    const { width, height } = image;

    if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
      return img;
    }

    image.scaleToFit({ w: MAX_DIMENSION, h: MAX_DIMENSION });

    const outputMime = img.mimeType === 'image/gif' ? 'image/png' : img.mimeType;
    let outBuffer: Buffer;
    if (outputMime === 'image/jpeg') {
      outBuffer = await image.getBuffer('image/jpeg', { quality: 92 });
    } else {
      outBuffer = await image.getBuffer(outputMime as 'image/png' | 'image/webp' | 'image/bmp' | 'image/tiff');
    }

    console.log(`[image-resize] Resized ${img.name}: ${width}x${height} → ${image.width}x${image.height}`);
    return { name: img.name, mimeType: outputMime, data: outBuffer.toString('base64') };
  } catch (err) {
    console.warn(`[image-resize] Failed to process ${img.name}, using original:`, err);
    return img;
  }
}

/** Aspect-ratio threshold: images with longEdge/shortEdge >= this are treated as "super-long" and sliced. */
const LONG_IMAGE_RATIO = 3;
/** Maximum number of tiles when slicing a super-long image. */
const MAX_TILES = 8;

/**
 * Base64 size threshold for fast-reject before full image decode (~48 MB decoded).
 */
const MAX_BASE64_LENGTH = 64 * 1024 * 1024;

/**
 * Process a user-uploaded image for the Claude API.
 * - Normal images: resize inline (single decode) → returns 1-element array.
 * - Super-long images (aspect ratio ≥ 3:1 and long edge > MAX_DIMENSION): slice into 1:2 tiles
 *   so that text remains readable after scaling, then return multiple image payloads.
 */
export async function processImage(img: ImagePayload): Promise<ImagePayload[]> {
  if (img.data.length > MAX_BASE64_LENGTH) {
    const sizeMB = (img.data.length / 1024 / 1024).toFixed(1);
    console.warn(`[image-resize] User image too large (${sizeMB} MB base64), stripping`);
    throw new Error(`图片过大（${sizeMB} MB），请压缩后重试`);
  }

  try {
    const buffer = Buffer.from(img.data, 'base64');
    const image = await Jimp.fromBuffer(buffer);
    const { width, height } = image;

    const shortEdge = Math.min(width, height);
    const longEdge = Math.max(width, height);
    const isVertical = height > width;

    const outputMime = img.mimeType === 'image/gif' ? 'image/png' : img.mimeType;

    // Non-super-long: resize in-place
    if (longEdge / shortEdge < LONG_IMAGE_RATIO || longEdge <= MAX_DIMENSION) {
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        return [img];
      }
      image.scaleToFit({ w: MAX_DIMENSION, h: MAX_DIMENSION });
      let outBuffer: Buffer;
      if (outputMime === 'image/jpeg') {
        outBuffer = await image.getBuffer('image/jpeg', { quality: 92 });
      } else {
        outBuffer = await image.getBuffer(outputMime as 'image/png' | 'image/webp' | 'image/bmp' | 'image/tiff');
      }
      console.log(`[image-resize] Resized ${img.name}: ${width}x${height} → ${image.width}x${image.height}`);
      return [{ name: img.name, mimeType: outputMime, data: outBuffer.toString('base64') }];
    }

    // Super-long image — slice into 1:2 tiles along the long axis
    const tileTarget = shortEdge * 2;
    let tileCount = Math.ceil(longEdge / tileTarget);
    tileCount = Math.min(tileCount, MAX_TILES);
    const tileSize = Math.ceil(longEdge / tileCount);
    const overlap = Math.round(tileSize * 0.1);

    const tiles: ImagePayload[] = [];
    for (let i = 0; i < tileCount; i++) {
      const start = Math.max(0, i * tileSize - (i > 0 ? overlap : 0));
      const end = Math.min(longEdge, (i + 1) * tileSize);

      const cropX = isVertical ? 0 : start;
      const cropY = isVertical ? start : 0;
      const cropW = isVertical ? width : end - start;
      const cropH = isVertical ? end - start : height;

      const tile = image.clone().crop({ x: cropX, y: cropY, w: cropW, h: cropH });
      tile.scaleToFit({ w: MAX_DIMENSION, h: MAX_DIMENSION });

      let outBuffer: Buffer;
      if (outputMime === 'image/jpeg') {
        outBuffer = await tile.getBuffer('image/jpeg', { quality: 92 });
      } else {
        outBuffer = await tile.getBuffer(outputMime as 'image/png' | 'image/webp' | 'image/bmp' | 'image/tiff');
      }

      tiles.push({
        name: `${img.name}_tile_${i + 1}`,
        mimeType: outputMime,
        data: outBuffer.toString('base64'),
      });
    }

    console.log(
      `[image-resize] Sliced ${img.name}: ${width}x${height} → ${tileCount} tiles (${isVertical ? 'vertical' : 'horizontal'})`
    );
    return tiles;
  } catch (err) {
    console.warn(`[image-resize] processImage failed for ${img.name}, falling back to resize:`, err);
    const result = await resizeImageIfNeeded(img);
    return [result];
  }
}

/**
 * Resize oversized images in MCP tool result content blocks.
 * Returns a shallow-copied tool_response with resized images, or null if unchanged.
 */
export async function resizeToolImageContent(
  toolResponse: unknown
): Promise<Record<string, unknown> | null> {
  if (
    typeof toolResponse !== 'object' ||
    toolResponse === null ||
    !Array.isArray((toolResponse as { content?: unknown }).content)
  ) {
    return null;
  }

  const originalContent = (toolResponse as { content: McpContentBlock[] }).content;
  const content = [...originalContent];
  let modified = false;

  for (let i = 0; i < content.length; i++) {
    const block = content[i];
    if (block.type !== 'image' || !('data' in block) || typeof block.data !== 'string') {
      continue;
    }

    if (block.data.length > MAX_BASE64_LENGTH) {
      console.warn(
        `[image-resize] Tool image block ${i} too large (${(block.data.length / 1024 / 1024).toFixed(1)} MB base64), replacing with text`
      );
      content[i] = { type: 'text', text: '[Image too large to process — stripped to prevent API error]' } as McpTextContent;
      modified = true;
      continue;
    }

    try {
      const buffer = Buffer.from(block.data, 'base64');
      const image = await Jimp.fromBuffer(buffer);
      const { width, height } = image;

      if (width <= MAX_TOOL_IMAGE_DIMENSION && height <= MAX_TOOL_IMAGE_DIMENSION) {
        continue;
      }

      image.scaleToFit({ w: MAX_TOOL_IMAGE_DIMENSION, h: MAX_TOOL_IMAGE_DIMENSION });

      if (image.width > MAX_TOOL_IMAGE_DIMENSION || image.height > MAX_TOOL_IMAGE_DIMENSION) {
        console.warn(
          `[image-resize] scaleToFit produced ${image.width}x${image.height}, still exceeds ${MAX_TOOL_IMAGE_DIMENSION}px limit — stripping image`
        );
        content[i] = { type: 'text', text: '[Image resize failed — stripped to prevent API error]' } as McpTextContent;
        modified = true;
        continue;
      }

      const mimeType = ('mimeType' in block && typeof block.mimeType === 'string')
        ? block.mimeType
        : 'image/png';
      const outputMime = mimeType === 'image/gif' ? 'image/png' : mimeType;

      let outBuffer: Buffer;
      if (outputMime === 'image/jpeg') {
        outBuffer = await image.getBuffer('image/jpeg', { quality: 92 });
      } else {
        outBuffer = await image.getBuffer(outputMime as 'image/png' | 'image/webp' | 'image/bmp' | 'image/tiff');
      }

      console.log(
        `[image-resize] Tool image resized: ${width}x${height} → ${image.width}x${image.height}`
      );

      content[i] = { ...block, data: outBuffer.toString('base64'), mimeType: outputMime };
      modified = true;
    } catch (err) {
      console.warn(`[image-resize] Failed to resize tool image block ${i}, stripping:`, err);
      content[i] = { type: 'text', text: '[Image could not be processed — stripped to prevent API error]' } as McpTextContent;
      modified = true;
    }
  }

  return modified ? { ...(toolResponse as object), content } : null;
}
