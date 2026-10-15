import Papa from "papaparse";
import type { Sheet } from "./data";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 10000;

export function matrixToSheet(name: string, rawMatrix: unknown[][]): Sheet {
  const lastRow = rawMatrix.findLastIndex((row) =>
    row.some((cell) => String(cell ?? "").trim() !== ""),
  );
  const matrix = rawMatrix.slice(0, lastRow + 1);
  if (!matrix.length) throw new Error("文件或工作表为空。");
  if (matrix.length > MAX_ROWS + 1)
    throw new Error(`每张表最多支持 ${MAX_ROWS.toLocaleString()} 条数据。`);
  const width = Math.max(...matrix.map((row) => row.length));
  if (width > 100) throw new Error("每张表最多支持 100 列。");
  if (matrix[0].every((cell) => !String(cell ?? "").trim()))
    throw new Error("第一行必须是列标题。");
  return {
    name,
    headers: matrix[0].map(
      (cell, index) => String(cell ?? "").trim() || `未命名列 ${index + 1}`,
    ),
    rows: matrix.slice(1),
  };
}

export function parseCsv(text: string): Sheet {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""));
  const errors = result.errors.filter(
    (error) => error.code !== "UndetectableDelimiter",
  );
  if (errors.length) throw new Error(`CSV 解析失败：${errors[0].message}`);
  return matrixToSheet("CSV", result.data);
}

export async function readLocalFile(file: File): Promise<Sheet[]> {
  if (!/\.(csv|xlsx)$/i.test(file.name))
    throw new Error("请选择 .csv 或 .xlsx 文件。");
  if (file.size > MAX_FILE_BYTES) throw new Error("文件不能超过 10 MB。");
  const buffer = await file.arrayBuffer();
  if (/\.csv$/i.test(file.name)) {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      text = new TextDecoder("gb18030", { fatal: true }).decode(buffer);
    }
    return [parseCsv(text)];
  }
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    sheetRows: MAX_ROWS + 2,
  });
  const sheets = workbook.SheetNames.flatMap((name) => {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      defval: null,
      blankrows: true,
      range: 0,
    });
    return matrix.length ? [matrixToSheet(name, matrix)] : [];
  });
  if (!sheets.length) throw new Error("工作簿中没有非空工作表。");
  return sheets;
}

export function downloadCsv(content: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8;" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
