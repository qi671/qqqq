import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  csvCell,
  demoSamples,
  filterSamples,
  guessMapping,
  knownFe,
  MISSING,
  parseNumeric,
  partialCurrent,
  toCsv,
  validateRows,
  type Sheet,
} from "../src/lib/data";
import { matrixToSheet, parseCsv, readLocalFile } from "../src/lib/files";

const sheet = (rows: unknown[][]): Sheet => ({
  name: "test",
  headers: ["sample_id", "fe_ch4_pct", "fe_h2_pct", "j_total_ma_cm2"],
  rows,
});
const clean = (rows: unknown[][], fraction = false) => {
  const source = sheet(rows);
  return validateRows(source, guessMapping(source.headers), fraction);
};

describe("科学数据的缺失值与计算", () => {
  it("仅包含用户提供的两条示例观测，其他字段为空", () => {
    expect(
      demoSamples.map(({ cu, zr, ch4, h2 }) => ({ cu, zr, ch4, h2 })),
    ).toEqual([
      { cu: 0.45, zr: 3, ch4: 50, h2: 30 },
      { cu: 0.6, zr: 3, ch4: 50, h2: 20 },
    ]);
    for (const sample of demoSamples)
      for (const key of [
        "co",
        "c2",
        "temperature",
        "grinding",
        "loading",
        "totalCurrent",
      ] as const)
        expect(sample[key]).toBeNull();
    expect(demoSamples.map(knownFe)).toEqual([80, 70]);
  });
  it("区分缺失、零与实测值，显式转换 FE 单位", () => {
    for (const value of ["", null, "NA", "n/a", "未测", "—"])
      expect(parseNumeric(value)).toBeNull();
    expect(parseNumeric("0")).toBe(0);
    expect(parseNumeric(" 50％ ", true)).toBe(50);
    expect(parseNumeric("0.5", true, true)).toBe(50);
    expect(parseNumeric("50%", true, true)).toBe(50);
    expect(parseNumeric("0.5", true)).toBe(0.5);
  });
  it("只用实测总电流和已知 FE 计算，保留正负号", () => {
    expect(partialCurrent(200, 50)).toBe(100);
    expect(partialCurrent(-200, 30)).toBe(-60);
    expect(partialCurrent(null, 50)).toBeNull();
    expect(partialCurrent(200, null)).toBeNull();
    expect(partialCurrent(0, 50)).toBe(0);
    expect(partialCurrent(1e308, 50)).toBe(5e307);
    expect(knownFe({ ...demoSamples[0], ch4: null, h2: null })).toBeNull();
  });
});

describe("导入映射与校验", () => {
  it("识别中文字段与化学下标", () => {
    expect(
      guessMapping([
        "样品编号",
        "Cu 投料量",
        "Zr 投料量",
        "CH₄ FE",
        "H₂ FE",
        "总电流密度",
      ]),
    ).toEqual({ sampleId: 0, cu: 1, zr: 2, ch4: 3, h2: 4, totalCurrent: 5 });
  });
  it("拒绝重复映射与必要映射缺失", () => {
    expect(
      validateRows(sheet([["A", 50]]), { sampleId: 0, ch4: 0 }).samples,
    ).toHaveLength(0);
    expect(
      validateRows(sheet([["A", 50]]), { ch4: 1 }).issues[0].message,
    ).toContain("至少一个");
  });
  it("拒绝无效、非有限和越界数字，不污染有效行", () => {
    const result = clean([
      ["good", "50%", "20", -200],
      ["invalid", "abc", 20],
      ["over", 101, 20],
      ["negative", -1, 20],
      ["infinite", "1e999", 20],
      ["units", "50 mA", 20],
    ]);
    expect(result.samples).toHaveLength(1);
    expect(result.rejected).toBe(5);
    expect(result.samples[0].totalCurrent).toBe(-200);
    expect(
      result.issues.some((issue) => issue.row === 3 && issue.level === "error"),
    ).toBe(true);
  });
  it("拒绝缺失及重复编号，跳过空行", () => {
    const result = clean([
      ["A", 50, 30],
      ["A", 40, 20],
      ["", 50, 20],
      [null, null, null],
      ["B", null, 0],
    ]);
    expect(result.samples.map((sample) => sample.sampleId)).toEqual(["A", "B"]);
    expect(result.rejected).toBe(2);
    expect(result.samples[1].h2).toBe(0);
  });
  it("FE 小计超过 100% 只提示，不擅自归一化", () => {
    const result = clean([["A", 80, 30]]);
    expect(knownFe(result.samples[0])).toBe(110);
    expect(
      result.issues.some((issue) => issue.message.includes("超过 100%")),
    ).toBe(true);
  });
  it("保留空行后的源行号，拒绝超出标题的多余数据", () => {
    const source = parseCsv("sample_id,fe_ch4_pct\nA,50\n\nB,120\nC,50,30");
    const result = validateRows(source, guessMapping(source.headers));
    expect(result.samples).toHaveLength(1);
    expect(result.rejected).toBe(2);
    expect(
      result.issues
        .filter((issue) => issue.level === "error")
        .map((issue) => issue.row),
    ).toEqual([4, 5]);
  });
  it("保留缺失值并允许全空 FE 样品", () => {
    const result = clean([["A", "", ""]]);
    expect(result.samples[0].ch4).toBeNull();
    expect(knownFe(result.samples[0])).toBeNull();
  });
});

describe("本地文件与导出", () => {
  it("解析 BOM、引号、换行、中文及分号 CSV", () => {
    expect(
      parseCsv('\uFEFFsample_id,fe_ch4_pct\r\n"实验,一",50\r\n"实验\n二",20')
        .rows,
    ).toEqual([
      ["实验,一", "50"],
      ["实验\n二", "20"],
    ]);
    expect(parseCsv("sample_id;fe_ch4_pct\nA;50").headers).toEqual([
      "sample_id",
      "fe_ch4_pct",
    ]);
    expect(() => parseCsv('sample_id,fe_ch4_pct\n"unclosed,50')).toThrow();
  });
  it("样例模板和演示数据一致，导出再导入仍不补零", () => {
    const template = parseCsv(
      readFileSync("public/co2rr-template.csv", "utf8"),
    );
    const imported = validateRows(template, guessMapping(template.headers));
    expect(imported.samples).toEqual(demoSamples);
    const exported = parseCsv(toCsv(imported.samples));
    expect(
      validateRows(exported, guessMapping(exported.headers)).samples,
    ).toEqual(demoSamples);
    expect(exported.headers).toContain("j_ch4_ma_cm2");
    expect(exported.rows[0].slice(-4)).toEqual(["", "", "", ""]);
  });
  it("导出防止公式注入，并正确转义逗号、双引号", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("  +cmd")).toBe("'  +cmd");
    expect(csvCell('样品,"A"')).toBe('"样品,""A"""');
    expect(csvCell(-200)).toBe("-200");
    expect(csvCell(null)).toBe("");
  });
  it("浏览器本地解析 XLSX 并保留工作表与空单元格", async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["样品编号", "CH₄ FE", "CO FE"],
        ["A", 50, null],
      ]),
      "实验一",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["sample_id", "fe_h2_pct"],
        ["B", 20],
      ]),
      "实验二",
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), "空表");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const sheets = await readLocalFile(new File([buffer], "test.xlsx"));
    expect(sheets).toHaveLength(2);
    const result = validateRows(sheets[0], guessMapping(sheets[0].headers));
    expect(result.samples[0].co).toBeNull();
    expect(result.samples[0].ch4).toBe(50);
  });
  it("限制文件类型、大小、行列数和空表", async () => {
    await expect(readLocalFile(new File(["x"], "test.exe"))).rejects.toThrow(
      ".csv",
    );
    await expect(
      readLocalFile(
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], "test.csv"),
      ),
    ).rejects.toThrow("10 MB");
    expect(() => matrixToSheet("empty", [])).toThrow("为空");
    expect(() =>
      matrixToSheet(
        "many",
        Array.from({ length: 10002 }, () => ["a"]),
      ),
    ).toThrow("10,000");
    expect(() => matrixToSheet("wide", [Array(101).fill("a")])).toThrow(
      "100 列",
    );
  });
});

describe("样品筛选", () => {
  it("组合投料量、缺失制备条件和名称搜索", () => {
    expect(
      filterSamples(demoSamples, {
        cu: "0.45",
        zr: "3",
        temperature: MISSING,
        grinding: MISSING,
        loading: MISSING,
      }),
    ).toEqual([demoSamples[0]]);
    expect(filterSamples(demoSamples, { temperature: "300" })).toEqual([]);
    expect(filterSamples(demoSamples, {}, "0.60")).toEqual([demoSamples[1]]);
  });
});
