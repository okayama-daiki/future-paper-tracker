import { readFile, writeFile } from "node:fs/promises";
import { conferencesDataPath, isoNowWithoutMilliseconds } from "./shared.ts";

const raw = await readFile(conferencesDataPath, "utf8");
const data = JSON.parse(raw);

data.generated_at = isoNowWithoutMilliseconds();

await writeFile(conferencesDataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

console.log(`Updated generated_at in data/conferences.json to ${data.generated_at}`);
