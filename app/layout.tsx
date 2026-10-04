import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "척척사장봇 · 음식점 운영 관리",
  description: "직원부터 비용까지, 우리 가게의 운영을 한곳에서.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}

