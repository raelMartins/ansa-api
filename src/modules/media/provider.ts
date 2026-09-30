import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { env } from "../../config/env.js";

export type MediaUploadInput = {
  dataUrl: string;
  maxBytes?: number;
};

export type MediaUploadResult = {
  url: string;
  provider: "local_disk" | "cloudinary";
  simulated?: boolean;
};

export interface MediaProvider {
  readonly name: "local_disk" | "cloudinary";
  upload(input: MediaUploadInput): Promise<MediaUploadResult>;
}

export class LocalDiskMediaProvider implements MediaProvider {
  readonly name = "local_disk" as const;

  constructor(private readonly uploadsDir: string) {}

  async upload(input: MediaUploadInput): Promise<MediaUploadResult> {
    const max = input.maxBytes ?? 4_000_000;
    const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(input.dataUrl);
    if (!match?.[1] || !match[2]) {
      throw new Error("Invalid image data");
    }
    const mime = match[1];
    const buf = Buffer.from(match[2], "base64");
    if (buf.length > max) {
      throw new Error("Image is too large");
    }
    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
    await mkdir(this.uploadsDir, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    await writeFile(path.join(this.uploadsDir, filename), buf);
    return { url: `/uploads/${filename}`, provider: "local_disk" };
  }
}

/**
 * Cloudinary provider (PROTOTYPE stub).
 * OPEN: verify account limits, signed uploads, delivery URLs.
 * Secrets stay server-side only.
 */
export class CloudinaryMediaProvider implements MediaProvider {
  readonly name = "cloudinary" as const;

  constructor(
    private readonly cloudName: string,
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {}

  async upload(input: MediaUploadInput): Promise<MediaUploadResult> {
    // Fallback to local behavior until Cloudinary upload is fully configured.
    const local = new LocalDiskMediaProvider(getDefaultUploadsDir());
    const result = await local.upload(input);
    return { ...result, provider: "cloudinary", simulated: true };
  }
}

function getDefaultUploadsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..", "..", "..", "uploads");
}

export function resolveMediaProvider(uploadsDir: string): MediaProvider {
  const { MEDIA_PROVIDER, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env();
  if (
    MEDIA_PROVIDER === "cloudinary" &&
    CLOUDINARY_CLOUD_NAME &&
    CLOUDINARY_API_KEY &&
    CLOUDINARY_API_SECRET
  ) {
    return new CloudinaryMediaProvider(CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET);
  }
  return new LocalDiskMediaProvider(uploadsDir);
}
