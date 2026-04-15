import { readFile, writeFile } from "node:fs/promises";
import type { ConferencesData } from "./types.js";

export async function readConferencesData(filePath: string): Promise<ConferencesData> {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as ConferencesData;
}

export async function writeConferencesData(filePath: string, data: ConferencesData): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await writeFile(filePath, content + "\n", "utf-8");
}
