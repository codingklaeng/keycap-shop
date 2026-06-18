import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoThai = Noto_Sans_Thai({
  variable: "--font-sans",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Keycap Studio — สั่งพวงกุญแจคีย์แคป",
  description: "สั่งทำพวงกุญแจคีย์แคปตามชื่อ เลือกสี เลือกตัวห้อย",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${notoThai.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* fonts usable by the nameplate canvas */}
        <link
          href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&family=Mitr:wght@400;700&family=Prompt:wght@400;700&family=Charm:wght@400;700&family=Kanit:wght@400;700&family=Noto+Sans+Thai:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
