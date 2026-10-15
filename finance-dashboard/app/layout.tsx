import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'A股研究终端', description: 'A股估值与技术指标研究看板（演示）' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="zh-CN"><body>{children}</body></html>; }
