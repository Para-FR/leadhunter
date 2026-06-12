// Parser CSV minimal mais correct : gère les champs entre guillemets,
// les virgules et retours-ligne échappés, et les "" doublés.

export function parseCsv(input: string): Record<string, string>[] {
  // Retire le BOM UTF-8 éventuel (les CSV BrowserAct commencent par ﻿).
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) =>
    Object.fromEntries(headers.map((h, idx) => [h, (r[idx] ?? "").trim()])),
  );
}

/** Récupère la 1re valeur non vide parmi plusieurs noms de colonnes possibles.
 *  Tolère les valeurs non-string (nombres, etc.). */
export function pick(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    // match insensible à la casse / espaces / underscores
    const found = Object.keys(row).find(
      (rk) => rk.toLowerCase().replace(/[\s_]/g, "") === k.toLowerCase().replace(/[\s_]/g, ""),
    );
    if (found != null) {
      const v = row[found];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return "";
}
