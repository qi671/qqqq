"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Beaker,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  FileSpreadsheet,
  Filter,
  FlaskConical,
  FolderOpen,
  Info,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
  Zap,
} from "lucide-react";
import {
  demoSamples,
  fields,
  filterFields,
  filterSamples,
  format,
  knownFe,
  MISSING,
  parseNumeric,
  partialCurrent,
  productColors,
  productLabels,
  products,
  toCsv,
  type NumericField,
  type Sample,
  type Sheet,
} from "@/lib/data";
import { downloadCsv, readLocalFile } from "@/lib/files";
import ImportDialog from "./import-dialog";

const FeChart = dynamic(() => import("./charts"), {
  ssr: false,
  loading: () => <div className="chart-empty">正在准备图表…</div>,
});
const PAGE_SIZE = 10;

export default function Dashboard() {
  const [samples, setSamples] = useState<Sample[]>(() =>
    demoSamples.map((sample) => ({ ...sample })),
  );
  const [source, setSource] = useState("示例数据");
  const [filters, setFilters] = useState<Partial<Record<NumericField, string>>>(
    {},
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>(
    demoSamples.map((sample) => sample.sampleId),
  );
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<"original" | "ch4">("original");
  const [currentId, setCurrentId] = useState(demoSamples[0].sampleId);
  const [currentDraft, setCurrentDraft] = useState("");
  const [currentError, setCurrentError] = useState("");
  const [notice, setNotice] = useState("");
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [pending, setPending] = useState<{
    filename: string;
    sheets: Sheet[];
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const values = filterSamples(samples, filters, search);
    return sort === "ch4"
      ? [...values].sort((a, b) => (b.ch4 ?? -1) - (a.ch4 ?? -1))
      : values;
  }, [samples, filters, search, sort]);
  const compared = filtered.filter((sample) =>
    selected.includes(sample.sampleId),
  );
  const currentSample = samples.find((sample) => sample.sampleId === currentId);
  const knownCh4 = filtered
    .map((sample) => sample.ch4)
    .filter((value): value is number => value !== null);
  const maxCh4 = knownCh4.length ? Math.max(...knownCh4) : null;
  const missingCount = filtered.filter((sample) =>
    fields.some((field) => sample[field.key] === null),
  ).length;
  const measuredCurrentCount = filtered.filter(
    (sample) => sample.totalCurrent !== null,
  ).length;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pages - 1);
  const rows = filtered.slice(
    visiblePage * PAGE_SIZE,
    (visiblePage + 1) * PAGE_SIZE,
  );
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  async function openFile(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setFileError("");
    try {
      setPending({ filename: file.name, sheets: await readLocalFile(file) });
    } catch (error) {
      setFileError(
        error instanceof Error ? error.message : "读取失败，请检查文件格式。",
      );
    } finally {
      setBusy(false);
    }
  }

  function importSamples(imported: Sample[], warningCount: number) {
    setSamples(imported);
    setSource(pending?.filename ?? "本地文件");
    setPending(null);
    setFilters({});
    setSearch("");
    setPage(0);
    setSelected(imported.slice(0, 6).map((sample) => sample.sampleId));
    setCurrentId(imported[0].sampleId);
    setCurrentDraft(imported[0].totalCurrent?.toString() ?? "");
    setCurrentError("");
    setNotice(
      `已在本地导入 ${imported.length} 条样品；${warningCount} 条校验提示。缺失值保持为空。`,
    );
  }

  function resetDemo() {
    setSamples(demoSamples.map((sample) => ({ ...sample })));
    setSource("示例数据");
    setFilters({});
    setSearch("");
    setPage(0);
    setSelected(demoSamples.map((sample) => sample.sampleId));
    setCurrentId(demoSamples[0].sampleId);
    setCurrentDraft("");
    setCurrentError("");
    setNotice("已恢复两条示例数据，其他测量均为空。");
  }

  function saveCurrent() {
    try {
      const value = parseNumeric(currentDraft);
      setSamples((previous) =>
        previous.map((sample) =>
          sample.sampleId === currentId
            ? { ...sample, totalCurrent: value }
            : sample,
        ),
      );
      setCurrentError("");
      setNotice(
        value === null
          ? "已清除此样品的总电流密度与分电流。"
          : `已更新 ${currentId} 的实测总电流密度。`,
      );
    } catch {
      setCurrentError("请输入有限数字，或留空清除。单位为 mA/cm²。");
    }
  }

  function selectSample(id: string) {
    if (selected.includes(id))
      setSelected((previous) => previous.filter((item) => item !== id));
    else if (selected.length < 6) setSelected((previous) => [...previous, id]);
    else setNotice("最多同时比较 6 个样品，请先取消一个已选样品。");
  }

  const nav = (
    <>
      <div className="brand">
        <div className="brand-icon">
          <FlaskConical size={23} strokeWidth={1.7} />
        </div>
        <div>
          CO₂RR <span>Lab</span>
          <small>实验数据，清晰可见。</small>
        </div>
      </div>
      <div className="workspace">
        <span className="workspace-avatar">Cu</span>
        <div>
          Cu–ZrO₂ 研究空间<small>本地科研工作台</small>
        </div>
        <ChevronDown size={14} />
      </div>
      <div className="nav-label">工作空间</div>
      <nav aria-label="主导航">
        <a
          className="nav-item active"
          href="#overview"
          onClick={() => setMobileNav(false)}
        >
          <LayoutDashboard size={18} />
          实验概览
          <span className="nav-dot" />
        </a>
        <a
          className="nav-item"
          href="#samples"
          onClick={() => setMobileNav(false)}
        >
          <Database size={18} />
          样品数据<span className="nav-count">{samples.length}</span>
        </a>
        <a
          className="nav-item"
          href="#comparison"
          onClick={() => setMobileNav(false)}
        >
          <BarChart3 size={18} />
          样品比较
        </a>
        <a
          className="nav-item"
          href="#current"
          onClick={() => setMobileNav(false)}
        >
          <Zap size={18} />
          分电流计算
        </a>
      </nav>
      <div className="nav-label mt-8">研究工具</div>
      <a className="nav-item" href="/co2rr-template.csv" download>
        <FileSpreadsheet size={18} />
        CSV 示例模板
        <ArrowUpRight size={14} />
      </a>
      <a className="nav-item" href="#guide" onClick={() => setMobileNav(false)}>
        <BookOpen size={18} />
        数据使用说明
      </a>
      <div className="sidebar-bottom">
        <div className="privacy-card">
          <ShieldCheck size={22} />
          <strong>数据留在你的设备</strong>
          <p>
            文件仅在浏览器内处理。
            <br />
            安心探索每一组实验。
          </p>
          <span>
            <i /> 本地处理已启用
          </span>
        </div>
        <div className="sidebar-footer">
          <span className="lab-avatar">
            <Beaker size={16} />
          </span>
          <div>
            CO₂RR Lab<small>科研数据工作台 · v0.1</small>
          </div>
          <LockKeyhole size={14} />
        </div>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">{nav}</aside>
      {mobileNav && (
        <div className="mobile-overlay" onClick={() => setMobileNav(false)}>
          <aside
            className="sidebar mobile-sidebar"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="mobile-close icon-button"
              aria-label="关闭导航"
              onClick={() => setMobileNav(false)}
            >
              <X size={20} />
            </button>
            {nav}
          </aside>
        </div>
      )}
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="打开导航"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <span>研究空间</span>
            <ChevronRight size={13} />
            <strong>实验概览</strong>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <i /> 浏览器本地模式
            </span>
            <a href="#guide" className="help-link" aria-label="查看使用说明">
              <CircleHelp size={18} />
            </a>
            <span className="top-avatar">Lab</span>
          </div>
        </header>
        <div className="page-content" id="overview">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                EXPERIMENT WORKSPACE <span>/ CO₂ ELECTROREDUCTION</span>
              </div>
              <h1>
                实验数据概览
                <span className="heading-dot" />
              </h1>
              <p>从样品到产物，让每一次实验都有据可循。</p>
            </div>
            <div className="heading-actions">
              <a
                href="/co2rr-template.csv"
                download
                className="button secondary"
              >
                <ArrowDownToLine size={16} />
                示例模板
              </a>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={16} />
                {busy ? "正在读取…" : "导入实验数据"}
              </button>
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            aria-label="选择 CSV 或 XLSX 文件"
            onChange={(event) => {
              void openFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div className="source-line">
            <span className="source-tag">
              <span className="source-dot" />
              {source === "示例数据" ? "演示模式" : "本地文件"}
            </span>
            <span className="source-name">{source}</span>
            <span className="source-separator">·</span>
            <span>Cu–ZrO₂ 酸性 CO₂ 电还原</span>
            <button onClick={resetDemo}>
              <RotateCcw size={12} />
              恢复示例
            </button>
          </div>
          {notice && (
            <div className="toast" role="status">
              <Check size={17} />
              <span>{notice}</span>
              <button
                className="icon-button"
                aria-label="关闭提示"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {fileError && (
            <div className="error-banner" role="alert">
              {fileError}
            </div>
          )}
          <div className="stats-grid">
            <Stat
              title="当前样品"
              value={String(filtered.length).padStart(2, "0")}
              unit="个"
              icon={<FlaskConical size={19} />}
              detail={`共 ${samples.length} 个样品 · ${activeFilterCount ? `${activeFilterCount} 项筛选生效` : "全部条件"}`}
              tone="teal"
            />
            <Stat
              title="最高 CH₄ 法拉第效率"
              value={maxCh4 === null ? "—" : format(maxCh4)}
              unit={maxCh4 === null ? "" : "%"}
              icon={<Activity size={19} />}
              detail={
                maxCh4 === null
                  ? "暂无 CH₄ 测量"
                  : `${knownCh4.length} 个样品有实测记录`
              }
              tone="blue"
            />
            <Stat
              title="总电流密度记录"
              value={String(measuredCurrentCount).padStart(2, "0")}
              unit={`/ ${filtered.length}`}
              icon={<Zap size={19} />}
              detail={
                measuredCurrentCount
                  ? "已输入样品可计算分电流"
                  : "输入实测值后计算分电流"
              }
              tone="amber"
            />
            <Stat
              title="含缺失值样品"
              value={String(missingCount).padStart(2, "0")}
              unit="个"
              icon={<FolderOpen size={19} />}
              detail="缺失值保留为空，不补零"
              tone="purple"
            />
          </div>
          <div
            className="import-strip"
            data-dragging={dragging}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void openFile(event.dataTransfer.files[0]);
            }}
          >
            <div className="import-strip-icon">
              <Upload size={21} />
            </div>
            <div>
              <strong>
                {busy ? "正在本地解析文件…" : "把实验数据带入工作台"}
              </strong>
              <p>
                拖放 CSV / XLSX 至此，或点击导入。支持列映射与数据校验，最大 10
                MB。
              </p>
            </div>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              选择文件 <ArrowRight size={15} />
            </button>
            <span className="import-lock">
              <LockKeyhole size={12} />
              本地解析
            </span>
          </div>
          {source === "示例数据" && (
            <div className="demo-note">
              <Info size={16} />
              <span>
                当前仅含两条已提供的示例观测；CO、C₂、制备条件及总电流密度均未提供。图表不推算其余产物。
              </span>
            </div>
          )}
          <section
            className="filter-panel panel"
            aria-labelledby="filter-title"
          >
            <div className="section-heading compact">
              <h2 id="filter-title">
                <SlidersHorizontal size={17} />
                样品筛选
              </h2>
              <button
                className="subtle-button"
                onClick={() => {
                  setFilters({});
                  setSearch("");
                  setPage(0);
                }}
              >
                <RotateCcw size={12} />
                重置条件
              </button>
            </div>
            <div className="filters-grid">
              {filterFields.map((key) => {
                const field = fields.find((item) => item.key === key)!;
                const values = [
                  ...new Set(
                    samples
                      .map((sample) => sample[key])
                      .filter((value): value is number => value !== null),
                  ),
                ].sort((a, b) => a - b);
                return (
                  <label key={key}>
                    <span>
                      {field.label}{" "}
                      <small>{"unit" in field ? `(${field.unit})` : ""}</small>
                    </span>
                    <select
                      value={filters[key] ?? ""}
                      onChange={(event) => {
                        setFilters((previous) => ({
                          ...previous,
                          [key]: event.target.value,
                        }));
                        setPage(0);
                      }}
                    >
                      <option value="">全部</option>
                      {values.map((value) => (
                        <option key={value} value={value}>
                          {format(value)}
                        </option>
                      ))}
                      <option value={MISSING}>未测 / 未提供</option>
                    </select>
                  </label>
                );
              })}
            </div>
          </section>
          <div className="charts-grid">
            <section className="panel chart-panel">
              <div className="section-heading">
                <div>
                  <h2>
                    产物法拉第效率 <span className="small-tag">FE</span>
                  </h2>
                  <p>按样品查看各产物的电子利用效率</p>
                </div>
                <span className="chart-unit">单位：%</span>
              </div>
              <FeChart samples={filtered} />
              <div className="chart-foot">
                <span>
                  <i className="tiny-dot" />
                  缺失产物不绘制柱形，未测 ≠ 0
                </span>
                <span>
                  {filtered.length > 12
                    ? "显示前 12 个样品"
                    : `${filtered.length} 个样品`}
                </span>
              </div>
            </section>
            <section className="panel chart-panel" id="comparison">
              <div className="section-heading">
                <div>
                  <h2>
                    样品对比{" "}
                    <span className="small-tag">{compared.length} / 6</span>
                  </h2>
                  <p>在下方数据表中勾选要比较的样品</p>
                </div>
                <BarChart3 size={18} className="muted" />
              </div>
              <FeChart samples={compared} comparison />
              <div className="chart-foot">
                <span>统一 0–100% 坐标，直接比较产物选择性</span>
                <button onClick={() => setSelected([])}>清空选择</button>
              </div>
            </section>
          </div>
          <section className="panel samples-panel" id="samples">
            <div className="section-heading table-heading">
              <div>
                <h2>
                  样品数据 <span className="small-tag">{filtered.length}</span>
                </h2>
                <p>保留原始观测，分电流随实测总电流密度更新</p>
              </div>
              <div className="table-tools">
                <label className="search-field">
                  <Search size={15} />
                  <input
                    placeholder="搜索样品编号"
                    aria-label="搜索样品编号"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(0);
                    }}
                  />
                </label>
                <button
                  className="button secondary small"
                  disabled={!filtered.length}
                  onClick={() => {
                    downloadCsv(toCsv(filtered), "co2rr-cleaned.csv");
                    setNotice(
                      `已导出当前筛选的 ${filtered.length} 个样品，缺失字段为空。`,
                    );
                  }}
                >
                  <ArrowDownToLine size={14} />
                  导出 CSV
                </button>
              </div>
            </div>
            <div className="table-scroll">
              <table className="sample-table">
                <thead>
                  <tr>
                    <th className="checkbox-cell">
                      <span className="sr-only">比较选择</span>
                      <Filter size={13} />
                    </th>
                    <th>样品编号</th>
                    <th>
                      Cu / Zr <small>mmol</small>
                    </th>
                    <th>
                      焙烧 <small>°C</small>
                    </th>
                    <th>
                      研磨 <small>min</small>
                    </th>
                    <th>
                      载量 <small>mg/cm²</small>
                    </th>
                    {products.map((key) => (
                      <th key={key}>
                        {key === "ch4" ? (
                          <button
                            className="sort-button"
                            onClick={() => {
                              setSort(sort === "original" ? "ch4" : "original");
                              setPage(0);
                            }}
                          >
                            {productLabels[key]} FE {sort === "ch4" ? "↓" : "↕"}
                          </button>
                        ) : (
                          `${productLabels[key]} FE`
                        )}
                        <small>%</small>
                      </th>
                    ))}
                    <th>
                      已知 FE 小计<small>% · 非完整总 FE</small>
                    </th>
                    <th>
                      j total<small>mA/cm²</small>
                    </th>
                    {products.map((key) => (
                      <th key={key}>
                        j {productLabels[key]}
                        <small>mA/cm²</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((sample) => (
                    <tr
                      key={sample.sampleId}
                      data-selected={selected.includes(sample.sampleId)}
                    >
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`比较 ${sample.sampleId}`}
                          checked={selected.includes(sample.sampleId)}
                          onChange={() => selectSample(sample.sampleId)}
                        />
                      </td>
                      <td className="sample-id">
                        <span className="sample-mark" />
                        {sample.sampleId}
                      </td>
                      <td className="tabular-nums">
                        {format(sample.cu)} / {format(sample.zr)}
                      </td>
                      <td>
                        <Value value={sample.temperature} />
                      </td>
                      <td>
                        <Value value={sample.grinding} />
                      </td>
                      <td>
                        <Value value={sample.loading} />
                      </td>
                      {products.map((key) => (
                        <td
                          key={key}
                          className={key === "ch4" ? "ch4-cell" : ""}
                        >
                          <Value value={sample[key]} />
                        </td>
                      ))}
                      <td>
                        <span
                          className={
                            knownFe(sample) !== null && knownFe(sample)! > 100
                              ? "warning-value"
                              : "subtotal"
                          }
                        >
                          {format(knownFe(sample))}
                        </span>
                      </td>
                      <td>
                        <Value value={sample.totalCurrent} />
                      </td>
                      {products.map((key) => (
                        <td key={key}>
                          <Value
                            value={partialCurrent(
                              sample.totalCurrent,
                              sample[key],
                            )}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <div className="empty-state">
                  <Search size={28} />
                  <strong>没有符合条件的样品</strong>
                  <span>尝试重置筛选，或导入新的实验数据。</span>
                </div>
              )}
            </div>
            <div className="table-footer">
              <span>
                <span className="tiny-dot" /> 已选 {selected.length} 个 ·
                当前筛选中 {compared.length} 个 · 横向滚动查看全部字段
              </span>
              <div>
                <span>
                  {filtered.length ? visiblePage * PAGE_SIZE + 1 : 0}–
                  {Math.min((visiblePage + 1) * PAGE_SIZE, filtered.length)} /{" "}
                  {filtered.length}
                </span>
                <button
                  className="icon-button"
                  aria-label="上一页"
                  disabled={visiblePage === 0}
                  onClick={() => setPage(visiblePage - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="下一页"
                  disabled={visiblePage >= pages - 1}
                  onClick={() => setPage(visiblePage + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </section>
          <section className="panel current-panel" id="current">
            <div className="current-intro">
              <div className="current-icon">
                <Zap size={20} />
              </div>
              <h2>把选择性，换算为产率指标</h2>
              <p>输入该样品的实测总电流密度，计算各产物的分电流密度。</p>
              <code>
                j<sub>product</sub> = j<sub>total</sub> × FE / 100
              </code>
              <p className="helper">
                保留输入正负号；若使用阴极电流绝对值，请输入正值。FE
                或总电流缺失时不计算。
              </p>
            </div>
            <div className="current-workspace">
              <div className="current-inputs">
                <label>
                  选择样品
                  <select
                    value={currentId}
                    onChange={(event) => {
                      const sample = samples.find(
                        (item) => item.sampleId === event.target.value,
                      );
                      setCurrentId(event.target.value);
                      setCurrentDraft(sample?.totalCurrent?.toString() ?? "");
                      setCurrentError("");
                    }}
                  >
                    {samples.map((sample) => (
                      <option key={sample.sampleId} value={sample.sampleId}>
                        {sample.sampleId}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  实测 j total <small>(mA/cm²)</small>
                  <input
                    aria-label="实测总电流密度"
                    inputMode="decimal"
                    placeholder="请输入实测值"
                    value={currentDraft}
                    onChange={(event) => setCurrentDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") saveCurrent();
                    }}
                  />
                </label>
                <button className="button primary" onClick={saveCurrent}>
                  计算
                  <ArrowRight size={15} />
                </button>
              </div>
              {currentError && (
                <p className="input-error" role="alert">
                  {currentError}
                </p>
              )}
              <div className="current-results">
                {products.map((key) => (
                  <div key={key}>
                    <span>
                      <i style={{ background: productColors[key] }} />j{" "}
                      {productLabels[key]}
                    </span>
                    <strong>
                      {format(
                        currentSample
                          ? partialCurrent(
                              currentSample.totalCurrent,
                              currentSample[key],
                            )
                          : null,
                      )}
                      <small>mA/cm²</small>
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="guide" id="guide">
            <div>
              <ShieldCheck size={17} />
              <h2>为可追溯的科研数据而设计</h2>
            </div>
            <p>
              文件只在当前浏览器内存中解析，不上传、不保存到数据库；刷新页面将恢复示例。CSV
              支持 UTF-8 / GB18030，XLSX 可选择工作表；单表最多 10,000 行、100
              列。样品编号需唯一；数值错误的行排除，缺失值留空。C₂
              作为用户提供的汇总 FE
              读取，不推测具体产物。导出包含当前筛选样品与计算结果。
            </p>
            <a href="/co2rr-template.csv" download>
              下载字段示例 <ArrowUpRight size={13} />
            </a>
          </section>
          <footer className="page-footer">
            <span>
              CO₂RR Lab <span className="footer-divider">/</span>{" "}
              让实验数据回归研究本身。
            </span>
            <span>
              <LockKeyhole size={12} /> 本地优先 · 无需登录
            </span>
          </footer>
        </div>
      </main>
      {pending && (
        <ImportDialog
          sheets={pending.sheets}
          filename={pending.filename}
          onClose={() => setPending(null)}
          onImport={importSamples}
        />
      )}
    </div>
  );
}

function Value({ value }: { value: number | null }) {
  return (
    <span className={value === null ? "missing-value" : "tabular-nums"}>
      {format(value)}
    </span>
  );
}

function Stat({
  title,
  value,
  unit,
  icon,
  detail,
  tone,
}: {
  title: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  detail: string;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <span className={`stat-icon ${tone}`}>{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        <small>{unit}</small>
      </div>
      <div className="stat-detail">
        <span className={`tiny-dot ${tone}`} />
        {detail}
      </div>
    </div>
  );
}
