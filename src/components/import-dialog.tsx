"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, FileSpreadsheet, X } from "lucide-react";
import {
  fields,
  guessMapping,
  validateRows,
  type Field,
  type Mapping,
  type Sample,
  type Sheet,
} from "@/lib/data";

type Props = {
  sheets: Sheet[];
  filename: string;
  onClose: () => void;
  onImport: (samples: Sample[], warningCount: number) => void;
};

export default function ImportDialog({
  sheets,
  filename,
  onClose,
  onImport,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<Mapping>(() =>
    guessMapping(sheets[0].headers),
  );
  const [fraction, setFraction] = useState(false);
  const sheet = sheets[sheetIndex];
  const result = useMemo(
    () => validateRows(sheet, mapping, fraction),
    [sheet, mapping, fraction],
  );
  const warnings = result.issues.filter((issue) => issue.level === "warning");

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function chooseSheet(index: number) {
    setSheetIndex(index);
    setMapping(guessMapping(sheets[index].headers));
  }

  return (
    <dialog
      ref={dialog}
      className="import-dialog"
      onCancel={onClose}
      aria-labelledby="import-title"
    >
      <div className="dialog-heading">
        <div>
          <span className="eyebrow">LOCAL DATA IMPORT</span>
          <h2 id="import-title">映射与校验数据</h2>
          <p>
            <FileSpreadsheet size={15} /> {filename} · 仅在此浏览器读取
          </p>
        </div>
        <button className="icon-button" aria-label="关闭导入" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="dialog-body">
        <div className="mapping-options">
          <label>
            工作表
            <select
              aria-label="工作表"
              value={sheetIndex}
              onChange={(event) => chooseSheet(Number(event.target.value))}
            >
              {sheets.map((item, index) => (
                <option key={index} value={index}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            无百分号的 FE 数值单位
            <select
              aria-label="无百分号的 FE 数值单位"
              value={fraction ? "fraction" : "percent"}
              onChange={(event) =>
                setFraction(event.target.value === "fraction")
              }
            >
              <option value="percent">百分数（50 表示 50%）</option>
              <option value="fraction">小数（0.5 表示 50%）</option>
            </select>
          </label>
        </div>
        <p className="helper">
          第一行为标题。编号及至少一列 FE
          为必选；其余字段可不映射。单位需与下表一致。带 %
          的值始终按百分数读取。
        </p>
        <div className="mapping-grid">
          {fields.map((field) => (
            <label key={field.key}>
              <span>
                {field.label}
                {"unit" in field && <small> {field.unit}</small>}
                {field.key === "sampleId" && <b> *</b>}
              </span>
              <select
                aria-label={`映射 ${field.label}`}
                value={mapping[field.key] ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setMapping((previous) => ({
                    ...previous,
                    [field.key as Field]:
                      value === "" ? undefined : Number(value),
                  }));
                }}
              >
                <option value="">— 不映射 / 保留缺失 —</option>
                {sheet.headers.map((header, index) => (
                  <option key={index} value={index}>
                    {index + 1}. {header}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <h3 className="preview-title">
          原始数据预览 <span>前 3 行</span>
        </h3>
        <div className="table-scroll raw-preview">
          <table>
            <thead>
              <tr>
                {sheet.headers.map((header, index) => (
                  <th key={index}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.slice(0, 3).map((row, index) => (
                <tr key={index}>
                  {sheet.headers.map((_, column) => (
                    <td key={column}>{String(row[column] ?? "—")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="validation-summary" role="status">
          <Check size={17} />
          <strong>{result.samples.length} 条可导入</strong>
          <span>
            {result.rejected} 条无效 · {warnings.length} 条提示
          </span>
        </div>
        <p className="helper">
          缺失值保留为空；无效行排除。FE 超过 100%
          的小计会提示，原值不归一化。确认后替换当前工作台数据。
        </p>
        {result.issues.length > 0 && (
          <details className="issues" open={result.samples.length === 0}>
            <summary>查看校验明细（{result.issues.length}）</summary>
            <ul>
              {result.issues.slice(0, 100).map((issue, index) => (
                <li key={index} className={issue.level}>
                  <b>第 {issue.row} 行</b> · {issue.message}
                </li>
              ))}
            </ul>
            {result.issues.length > 100 && (
              <p>显示前 100 条，共 {result.issues.length} 条。</p>
            )}
          </details>
        )}
      </div>
      <div className="dialog-footer">
        <button className="button secondary" onClick={onClose}>
          取消
        </button>
        <button
          className="button primary"
          disabled={!result.samples.length}
          onClick={() => onImport(result.samples, warnings.length)}
        >
          确认导入 {result.samples.length} 条样品 <ArrowRight size={16} />
        </button>
      </div>
    </dialog>
  );
}
