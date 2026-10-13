// Prepares the owner's photo in the browser before it is sent (03.2-09, contract 5.10, research 3.1): decode, scale so
// the long edge is at most 2560 px, re-encode (WebP when the browser can write it, else JPEG at 0.85), and hash the
// bytes (SHA-256, lowercase hex) so the server can store the file once under a content-addressed key. Re-encoding also
// drops the camera's metadata. No request is sent here; the caller sends the result with opsPut.
//
// The pure parts (scale, output type, hex) are plain functions so node tests load this file directly: no import.

/** The longest side of a stored photo, in pixels. */
export const MAX_EDGE = 2560;
/** JPEG quality when WebP is not available. */
export const JPEG_QUALITY = 0.85;
/** WebP quality. */
export const WEBP_QUALITY = 0.85;
/** The largest file the server takes, in bytes: 10 MB, as the server's MAX_UPLOAD_BYTES (job 03.2-09b). */
export const MAX_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type OutputType = "image/webp" | "image/jpeg";

export type PreparedImage = {
  blob: Blob;
  contentType: OutputType;
  width: number;
  height: number;
  /** 64 lowercase hex characters, of the bytes in `blob`. */
  sha256: string;
  bytes: number;
};

/** Why a file cannot be sent: another type (HEIC included), a file that does not decode, or a result over 10 MB. */
export type PrepFailure = "wrong_type" | "too_large";

export class ImagePrepError extends Error {
  readonly reason: PrepFailure;
  constructor(reason: PrepFailure) {
    super(reason);
    this.name = "ImagePrepError";
    this.reason = reason;
  }
}

export function isAcceptedType(type: string): boolean {
  return (ACCEPTED_TYPES as readonly string[]).includes(type.toLowerCase());
}

/** The size after scaling: the long edge is `max` or less, the ratio is kept, a side is never below 1. */
export function scaleToFit(width: number, height: number, max: number = MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const ratio = max / longest;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

/** WebP when the 1x1 probe came back as WebP (Safari answers PNG for a type it cannot write), else JPEG. */
export function chooseOutputType(probeType: string | null | undefined): OutputType {
  return probeType === "image/webp" ? "image/webp" : "image/jpeg";
}

/** Lowercase hex of bytes (two characters each). */
export function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = "";
  for (const byte of view) out += byte.toString(16).padStart(2, "0");
  return out;
}

// ---- browser part -----------------------------------------------------------------------------------------------

type Surface = OffscreenCanvas | HTMLCanvasElement;

function makeSurface(width: number, height: number): Surface {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function encode(surface: Surface, type: OutputType, quality: number): Promise<Blob | null> {
  if (typeof OffscreenCanvas !== "undefined" && surface instanceof OffscreenCanvas) {
    return surface.convertToBlob({ type, quality }).catch(() => null);
  }
  const canvas = surface as HTMLCanvasElement;
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

let probed: OutputType | null = null;

/** Asks the browser to write a 1x1 WebP and reads the type it actually returned. Asked once per page. */
async function outputType(): Promise<OutputType> {
  if (probed) return probed;
  const blob = await encode(makeSurface(1, 1), "image/webp", WEBP_QUALITY);
  probed = chooseOutputType(blob?.type);
  return probed;
}

/**
 * Decode, scale, re-encode and hash `file`. Throws ImagePrepError("wrong_type") for a type outside JPEG, PNG and WebP
 * (an iPhone HEIC that was not converted) or a file that does not decode, and ("too_large") when the result is over 10 MB.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!isAcceptedType(file.type)) throw new ImagePrepError("wrong_type");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImagePrepError("wrong_type");
  }
  try {
    const { width, height } = scaleToFit(bitmap.width, bitmap.height);
    const type = await outputType();
    const surface = makeSurface(width, height);
    const context = surface.getContext("2d") as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!context) throw new ImagePrepError("wrong_type");
    if (type === "image/jpeg") {
      // JPEG has no transparency: a transparent PNG would turn black.
      context.fillStyle = "white";
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await encode(surface, type, type === "image/jpeg" ? JPEG_QUALITY : WEBP_QUALITY);
    if (!blob) throw new ImagePrepError("wrong_type");
    if (blob.size > MAX_BYTES) throw new ImagePrepError("too_large");
    const sha256 = toHex(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
    return { blob, contentType: type, width, height, sha256, bytes: blob.size };
  } finally {
    bitmap.close();
  }
}
