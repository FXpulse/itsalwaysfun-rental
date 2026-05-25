// Minimal CSV parser — handles quoted values, escaped quotes, newlines in quotes.
// No external deps. Returns array of row objects keyed by header column names.

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[]; // per-row parse errors
}

export function parseCsv(text: string): ParsedCsv {
  const result: ParsedCsv = { headers: [], rows: [], errors: [] };
  if (!text || !text.trim()) {
    result.errors.push("Empty CSV");
    return result;
  }

  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const lines = parseCsvLines(text);
  if (lines.length === 0) {
    result.errors.push("No rows");
    return result;
  }

  result.headers = lines[0].map((h) => h.trim());
  if (result.headers.length === 0) {
    result.errors.push("No headers");
    return result;
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i];
    // Skip totally blank lines
    if (cells.every((c) => c.trim() === "")) continue;

    const row: Record<string, string> = {};
    for (let j = 0; j < result.headers.length; j++) {
      row[result.headers[j]] = (cells[j] ?? "").trim();
    }
    result.rows.push(row);
  }

  return result;
}

/** Split CSV text into array of row arrays, honoring quotes. */
function parseCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        // Escaped quote
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        current.push(cell);
        cell = "";
      } else if (c === "\n" || c === "\r") {
        // End of row
        current.push(cell);
        rows.push(current);
        current = [];
        cell = "";
        // Skip \r\n combo
        if (c === "\r" && next === "\n") i++;
      } else {
        cell += c;
      }
    }
  }
  // Last cell + row
  if (cell !== "" || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }

  return rows;
}

export function csvToText(headers: string[], rows: any[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(","));
  }
  return lines.join("\n");
}

function csvCell(v: any): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
