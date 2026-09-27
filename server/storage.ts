import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const DATA_DIR = path.resolve(process.env.TRACECART_DATA_DIR ?? path.join(process.cwd(), "data"));
export const EXPORT_DIR = path.join(DATA_DIR, "exports");

export async function ensureDataDirectories() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(EXPORT_DIR, { recursive: true });
}

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, name), "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson<T>(name: string, value: T) {
  const target = path.join(DATA_DIR, name);
  const temporary = target + ".tmp";
  await writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
  await rename(temporary, target);
}

export async function appendNdjson(name: string, value: unknown) {
  await appendFile(path.join(DATA_DIR, name), JSON.stringify(value) + "\n", "utf8");
}

export async function readNdjson<T>(name: string): Promise<T[]> {
  try {
    const content = await readFile(path.join(DATA_DIR, name), "utf8");
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}
