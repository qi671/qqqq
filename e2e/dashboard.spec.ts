import { expect, test } from "@playwright/test";

test("本地导入、筛选、实测分电流、导出与缺失值", async ({ page }) => {
  const errors: string[] = [];
  const outbound: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      !new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/) ||
      !["GET", "HEAD"].includes(request.method())
    )
      outbound.push(request.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "实验数据概览" }),
  ).toBeVisible();
  await expect(page.locator(".sample-table tbody tr")).toHaveCount(2);
  await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible();
  await page.locator(".recharts-bar-rectangle").first().hover();
  await expect(page.locator(".recharts-tooltip-item-name").first()).toHaveText(
    "CH₄",
  );
  await page.getByLabel("比较 Cu-0.45 / Zr-3", { exact: true }).uncheck();
  await expect(page.locator("#comparison .small-tag")).toContainText("1 / 6");
  await expect(page.locator(".current-results")).toContainText("未测");
  await page.getByLabel("实测总电流密度", { exact: true }).fill("200");
  await page.getByRole("button", { name: "计算", exact: true }).click();
  await expect(page.locator(".current-results > div").nth(0)).toContainText(
    "100",
  );
  await expect(page.locator(".current-results > div").nth(1)).toContainText(
    "60",
  );
  await expect(page.locator(".current-results > div").nth(2)).toContainText(
    "未测",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 CSV", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("co2rr-cleaned.csv");
  await page.getByLabel("选择 CSV 或 XLSX 文件").setInputFiles({
    name: "local.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "编号,铜,锆,温度,研磨,载量,甲烷,氢气\n实测A,0.45,3,300,15,1,50,30\n实测B,0.6,3,400,30,2,50,20\n错误行,0.9,3,300,15,1,120,20",
    ),
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  const mapping = {
    样品编号: "0",
    "Cu 投料量": "1",
    "Zr 投料量": "2",
    焙烧温度: "3",
    研磨时间: "4",
    催化剂载量: "5",
    "CH₄ FE": "6",
    "H₂ FE": "7",
  };
  for (const [field, index] of Object.entries(mapping))
    await page.getByLabel(`映射 ${field}`, { exact: true }).selectOption(index);
  await expect(page.locator(".validation-summary")).toContainText("2 条可导入");
  await expect(page.locator(".validation-summary")).toContainText("1 条无效");
  await page.getByRole("button", { name: "确认导入 2 条样品" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".sample-table tbody tr")).toHaveCount(2);
  await page.locator(".filters-grid select").nth(0).selectOption("0.45");
  await page.locator(".filters-grid select").nth(1).selectOption("3");
  await page.locator(".filters-grid select").nth(2).selectOption("300");
  await page.locator(".filters-grid select").nth(3).selectOption("15");
  await page.locator(".filters-grid select").nth(4).selectOption("1");
  await expect(page.locator(".sample-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".sample-table tbody")).toContainText("实测A");
  await page.getByRole("button", { name: "重置条件" }).click();
  await expect(page.locator(".sample-table tbody tr")).toHaveCount(2);
  await page.getByLabel("搜索样品编号").fill("不存在");
  await expect(
    page.getByText("没有符合条件的样品", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".sample-table tbody")).toContainText(
    "Cu-0.45 / Zr-3",
  );
  expect(outbound).toEqual([]);
  expect(errors).toEqual([]);
});

test("XLSX 工作表选择与小数 FE 转换", async ({ page }) => {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["sample_id", "fe_ch4_pct"],
      ["未选择", 0.1],
    ]),
    "第一表",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["sample_id", "fe_ch4_pct", "fe_h2_pct", "fe_co_pct", "j_total_ma_cm2"],
      ["Excel-测试", 0.5, 0.2, 0, -200],
    ]),
    "目标表",
  );
  await page.goto("/");
  await page.getByLabel("选择 CSV 或 XLSX 文件").setInputFiles({
    name: "synthetic.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  });
  await page.getByLabel("工作表", { exact: true }).selectOption("1");
  await page
    .getByLabel("无百分号的 FE 数值单位", { exact: true })
    .selectOption("fraction");
  await page.getByRole("button", { name: "确认导入 1 条样品" }).click();
  await expect(page.locator(".sample-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".sample-table tbody")).toContainText("Excel-测试");
  await expect(page.locator(".sample-table .ch4-cell")).toHaveText("50");
  await expect(page.locator(".current-results > div").nth(0)).toContainText(
    "-100",
  );
  await expect(page.locator(".current-results > div").nth(2)).toContainText(
    "0",
  );
  await expect(page.locator(".current-results > div").nth(3)).toContainText(
    "未测",
  );
});

test("手机视图无页面横向溢出，导航和本地导入可用", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "实验数据概览" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "打开导航" }).click();
  await expect(page.locator(".mobile-sidebar")).toBeVisible();
  await page.getByRole("button", { name: "关闭导航" }).click();
  await page
    .getByLabel("选择 CSV 或 XLSX 文件")
    .setInputFiles("public/co2rr-template.csv");
  await expect(
    page.getByRole("button", { name: "确认导入 2 条样品" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭导入" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
