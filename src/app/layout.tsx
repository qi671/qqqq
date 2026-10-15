import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CO₂RR Lab · 科研数据工作台",
  description: "在浏览器本地整理、比较 Cu–ZrO₂ 二氧化碳电还原实验数据。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
