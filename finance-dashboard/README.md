# A 股投资研究终端

位于 `qi671/qqqq/finance-dashboard` 的独立 Next.js 应用。

## 运行

```bash
cd finance-dashboard
npm install
npm run dev
```

Vercel 导入 `qi671/qqqq` 时，Root Directory 设为 `finance-dashboard`，Framework 为 Next.js。

## 当前实现

- 中文响应式页面、评分对比图、行业筛选、CSV 演示数据导入导出。
- 5 只股票的评分全部为**人工构造的演示值**，绝非实时行情或投资建议。
- 真实价格、PE、PB、MA60 等显示为未接入，绝不编造。
- CSV 本地解析，尚不支持引号包裹逗号的复杂 CSV。

## 后续金融数据接入

使用 AKShare `stock_zh_a_hist` 获取历史日线，按来源文档检查成交量单位与复权口径；使用 Tushare `daily`、`daily_basic`、`fina_indicator` 补充数据。采集任务运行于 Python 环境或 GitHub Actions；将 AIRTABLE_TOKEN、TUSHARE_TOKEN 放入 GitHub Actions Secrets，禁止写入公开仓库。Airtable 原始快照应通过服务端授权读取，不可在浏览器公开 PAT。API 调用失败要显示时间戳和错误状态，禁止回退为假行情。

## 安全

本仓库是 Public。不要上传实际持仓数量、成本价、私人财务记录或凭证。正式接入 Airtable 时务必为站点添加访问控制。
