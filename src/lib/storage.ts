import { promises as fs } from "node:fs";
import path from "node:path";

export function dataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

export async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  const dir = dataDir();
  await ensureDir(dir);
  const full = path.join(dir, fileName);
  try {
    const raw = await fs.readFile(full, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: any) {
    if (err?.code === "ENOENT") return fallback;
    throw err;
  }
}

export async function writeJson<T>(fileName: string, data: T): Promise<void> {
  const dir = dataDir();
  await ensureDir(dir);
  const full = path.join(dir, fileName);
  const tmp = full + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, full);
}

export function uploadsDir(): string {
  return path.join(dataDir(), "uploads");
}

export async function ensureUploadsDir(): Promise<void> {
  await ensureDir(uploadsDir());
}
