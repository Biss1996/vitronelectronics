import { S3Client } from "bun";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { config, spacesEnabled } from "./config.js";
import { badRequest } from "./http.js";

// Images go to DigitalOcean Spaces when SPACES_* is configured, otherwise to a
// local folder (fine for development; App Platform disks are wiped on redeploy).

const ALLOWED = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif" };

const s3 = spacesEnabled
  ? new S3Client({
      accessKeyId: config.spaces.key,
      secretAccessKey: config.spaces.secret,
      bucket: config.spaces.bucket,
      region: config.spaces.region,
      endpoint: config.spaces.endpoint,
    })
  : null;

const localDir = resolve(config.uploadDir);

export async function saveImage(file) {
  if (!(file instanceof File) && !(file instanceof Blob)) throw badRequest("No image received");
  const ext = ALLOWED[file.type];
  if (!ext) throw badRequest("Only JPG, PNG, WEBP, AVIF or GIF images are allowed");
  if (file.size > config.maxUploadBytes) throw badRequest("Image must be 5 MB or smaller");

  const key = `products/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;

  if (s3) {
    await s3.write(key, file, { type: file.type, acl: "public-read" });
    const base = config.spaces.publicUrl || `${config.spaces.endpoint.replace("://", `://${config.spaces.bucket}.`)}`;
    return { url: `${base}/${key}`, storage: "spaces" };
  }

  const path = join(localDir, key);
  await mkdir(join(path, ".."), { recursive: true });
  await Bun.write(path, file);
  return { url: `/api/uploads/${key}`, storage: "local" };
}

/** Serves locally stored uploads (development only). */
export async function serveLocalUpload(relPath) {
  const full = resolve(localDir, relPath);
  if (!full.startsWith(localDir + "/")) return null; // block ../ traversal
  const f = Bun.file(full);
  if (!(await f.exists())) return null;
  return new Response(f, { headers: { "cache-control": "public, max-age=31536000, immutable" } });
}

export const storageMode = s3 ? "spaces" : "local";
