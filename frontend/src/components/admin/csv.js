// Builds a CSV file (opens in Excel / Google Sheets) and downloads it.
const cell = (v) => {
  const s = v instanceof Date ? v.toISOString() : String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const downloadCSV = (filename, headers, rows) => {
  const text = [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  // BOM so Excel reads Urdu / special characters correctly
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
