/**
 * Parses the conferences.csv master data file.
 * CSV format: id,name,url,enabled (with header row)
 */
export interface ConferenceSeriesRow {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export function parseConferencesCSV(content: string): ConferenceSeriesRow[] {
  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Skip header row
  return lines
    .slice(1)
    .map((line) => parseCSVLine(line))
    .filter((row): row is ConferenceSeriesRow => row !== null);
}

function parseCSVLine(line: string): ConferenceSeriesRow | null {
  const fields = splitCSVLine(line);
  if (fields.length < 4) return null;

  const [id, name, url, enabled] = fields;
  if (!id || !name || !url || !enabled) return null;

  return {
    id: id.trim(),
    name: name.trim(),
    url: url.trim(),
    enabled: enabled.trim().toLowerCase() === "true",
  };
}

/**
 * Splits a CSV line respecting quoted fields.
 */
function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);

  return fields;
}
