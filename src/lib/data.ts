export const products = ["ch4", "h2", "co", "c2"] as const;
export type Product = (typeof products)[number];
export const productLabels: Record<Product, string> = {
  ch4: "CH₄",
  h2: "H₂",
  co: "CO",
  c2: "C₂",
};
export const productColors: Record<Product, string> = {
  ch4: "#0e8e80",
  h2: "#e9af50",
  co: "#709bc0",
  c2: "#a48bbd",
};

export const fields = [
  {
    key: "sampleId",
    label: "样品编号",
    header: "sample_id",
    aliases: ["样品", "样品名称", "sample", "id"],
  },
  {
    key: "cu",
    label: "Cu 投料量",
    unit: "mmol",
    header: "cu_mmol",
    aliases: ["cu", "cu投料量", "铜投料量"],
  },
  {
    key: "zr",
    label: "Zr 投料量",
    unit: "mmol",
    header: "zr_mmol",
    aliases: ["zr", "zr投料量", "锆投料量"],
  },
  {
    key: "temperature",
    label: "焙烧温度",
    unit: "°C",
    header: "calcination_c",
    aliases: ["焙烧温度", "temperature", "calcinationtemperature"],
  },
  {
    key: "grinding",
    label: "研磨时间",
    unit: "min",
    header: "grinding_min",
    aliases: ["研磨时间", "grinding", "grindingtime"],
  },
  {
    key: "loading",
    label: "催化剂载量",
    unit: "mg/cm²",
    header: "loading_mg_cm2",
    aliases: ["催化剂载量", "loading", "载量"],
  },
  {
    key: "ch4",
    label: "CH₄ FE",
    unit: "%",
    header: "fe_ch4_pct",
    aliases: ["ch4", "ch4fe", "fech4", "甲烷fe"],
  },
  {
    key: "h2",
    label: "H₂ FE",
    unit: "%",
    header: "fe_h2_pct",
    aliases: ["h2", "h2fe", "feh2", "氢气fe"],
  },
  {
    key: "co",
    label: "CO FE",
    unit: "%",
    header: "fe_co_pct",
    aliases: ["co", "cofe", "feco"],
  },
  {
    key: "c2",
    label: "C₂ FE",
    unit: "%",
    header: "fe_c2_pct",
    aliases: ["c2", "c2fe", "fec2"],
  },
  {
    key: "totalCurrent",
    label: "实测总电流密度",
    unit: "mA/cm²",
    header: "j_total_ma_cm2",
    aliases: ["总电流密度", "jtotal", "实测总电流密度"],
  },
] as const;

export type Field = (typeof fields)[number]["key"];
export type NumericField = Exclude<Field, "sampleId">;
export type Sample = { sampleId: string; sourceRow: number } & Record<
  NumericField,
  number | null
>;
export type Mapping = Partial<Record<Field, number>>;
export type Sheet = { name: string; headers: string[]; rows: unknown[][] };
export type Issue = {
  row: number;
  level: "error" | "warning";
  message: string;
};
export type Validation = {
  samples: Sample[];
  issues: Issue[];
  rejected: number;
};
export const filterFields: NumericField[] = [
  "cu",
  "zr",
  "temperature",
  "grinding",
  "loading",
];
export const MISSING = "__missing";

export const demoSamples: Sample[] = [
  {
    sampleId: "Cu-0.45 / Zr-3",
    sourceRow: 2,
    cu: 0.45,
    zr: 3,
    temperature: null,
    grinding: null,
    loading: null,
    ch4: 50,
    h2: 30,
    co: null,
    c2: null,
    totalCurrent: null,
  },
  {
    sampleId: "Cu-0.60 / Zr-3",
    sourceRow: 3,
    cu: 0.6,
    zr: 3,
    temperature: null,
    grinding: null,
    loading: null,
    ch4: 50,
    h2: 20,
    co: null,
    c2: null,
    totalCurrent: null,
  },
];

const normalize = (value: string) =>
  value.toLowerCase().replace(/[\s_()（）%％/²°₄₂·-]/g, "");
export function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const used = new Set<number>();
  for (const field of fields) {
    const names = [field.key, field.header, field.label, ...field.aliases].map(
      normalize,
    );
    const index = headers.findIndex(
      (header, i) => !used.has(i) && names.includes(normalize(header)),
    );
    if (index >= 0) {
      mapping[field.key] = index;
      used.add(index);
    }
  }
  return mapping;
}

export function parseNumeric(
  value: unknown,
  isFe = false,
  fraction = false,
): number | null {
  const text = String(value ?? "").trim();
  if (/^(?:|na|n\/a|null|nan|none|未测|缺失|—|-|--|nd)$/i.test(text))
    return null;
  const percent = /[%％]$/.test(text);
  if (percent && !isFe) throw new Error("此字段不接受百分号");
  const normalized = percent ? text.slice(0, -1).trim() : text;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized))
    throw new Error("应为有效数字");
  const number = Number(normalized) * (isFe && fraction && !percent ? 100 : 1);
  if (!Number.isFinite(number)) throw new Error("数值必须有限");
  return number;
}

export function validateRows(
  sheet: Sheet,
  mapping: Mapping,
  fraction = false,
): Validation {
  const issues: Issue[] = [];
  const samples: Sample[] = [];
  const mapped = Object.values(mapping).filter((value) => value !== undefined);
  if (
    mapping.sampleId === undefined ||
    !products.some((key) => mapping[key] !== undefined)
  ) {
    return {
      samples,
      rejected: 0,
      issues: [
        {
          row: 1,
          level: "error",
          message: "请映射样品编号和至少一个产物 FE 列。",
        },
      ],
    };
  }
  if (new Set(mapped).size !== mapped.length) {
    return {
      samples,
      rejected: 0,
      issues: [
        { row: 1, level: "error", message: "同一源列不能映射到多个字段。" },
      ],
    };
  }
  const seen = new Set<string>();
  let rejected = 0;
  sheet.rows.forEach((row, index) => {
    if (row.every((cell) => String(cell ?? "").trim() === "")) return;
    const sourceRow = index + 2;
    const sampleId = String(row[mapping.sampleId!] ?? "").trim();
    let invalid = false;
    const fail = (message: string) => {
      invalid = true;
      issues.push({ row: sourceRow, level: "error", message });
    };
    if (
      row
        .slice(sheet.headers.length)
        .some((cell) => String(cell ?? "").trim() !== "")
    )
      fail("数据列数超过标题列数，请检查 CSV 分隔符或引号。");
    if (!sampleId) fail("缺少样品编号。");
    else if (seen.has(sampleId))
      fail(`样品编号「${sampleId}」重复；请使用独立重复实验编号。`);
    const sample = { sampleId, sourceRow } as Sample;
    const missing: string[] = [];
    for (const field of fields) {
      if (field.key === "sampleId") continue;
      try {
        const isFe = products.includes(field.key as Product);
        const column = mapping[field.key];
        const value = parseNumeric(
          column === undefined ? null : row[column],
          isFe,
          fraction,
        );
        sample[field.key] = value;
        if (value === null) missing.push(field.label);
        else if (isFe && (value < 0 || value > 100))
          fail(`${field.label} 必须在 0–100% 之间。`);
        else if (field.key !== "totalCurrent" && value < 0)
          fail(`${field.label} 不能为负数。`);
        else if (field.key === "zr" && value === 0)
          fail("Zr 投料量必须大于 0，或留空。 ");
      } catch (error) {
        sample[field.key] = null;
        fail(
          `${field.label}：${error instanceof Error ? error.message : "数值无效"}。`,
        );
      }
    }
    if (invalid) {
      rejected += 1;
      return;
    }
    seen.add(sampleId);
    if (missing.length)
      issues.push({
        row: sourceRow,
        level: "warning",
        message: `缺失 ${missing.join("、")}；保留为空，不补零。`,
      });
    const sum = knownFe(sample);
    if (sum !== null && sum > 100 + 1e-8)
      issues.push({
        row: sourceRow,
        level: "warning",
        message: `已知 FE 小计 ${format(sum)}% 超过 100%，请核对；保留原值，不归一化。`,
      });
    samples.push(sample);
  });
  return { samples, issues, rejected };
}

export function knownFe(sample: Sample): number | null {
  const known = products
    .map((key) => sample[key])
    .filter((value): value is number => value !== null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) : null;
}

export function partialCurrent(
  total: number | null,
  fe: number | null,
): number | null {
  return total === null || fe === null ? null : total * (fe / 100);
}

export function format(value: number | null, digits = 2): string {
  return value === null
    ? "未测"
    : new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits }).format(
        value,
      );
}

export function filterSamples(
  samples: Sample[],
  filters: Partial<Record<NumericField, string>>,
  search = "",
): Sample[] {
  return samples.filter(
    (sample) =>
      sample.sampleId.toLowerCase().includes(search.trim().toLowerCase()) &&
      filterFields.every((key) => {
        const value = filters[key];
        return (
          !value ||
          (value === MISSING
            ? sample[key] === null
            : sample[key] !== null && sample[key] === Number(value))
        );
      }),
  );
}

// Prevent spreadsheet formula execution on export, including imported sample names.
export function csvCell(value: string | number | null): string {
  let text = value === null ? "" : String(value);
  if (typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text))
    text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(samples: Sample[]): string {
  const headers = [
    ...fields.map((field) => field.header),
    ...products.map((key) => `j_${key}_ma_cm2`),
  ];
  return (
    "\uFEFF" +
    [
      headers.join(","),
      ...samples.map((sample) =>
        [
          ...fields.map((field) => sample[field.key]),
          ...products.map((key) =>
            partialCurrent(sample.totalCurrent, sample[key]),
          ),
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\r\n")
  );
}
