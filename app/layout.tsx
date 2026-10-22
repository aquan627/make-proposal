import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RFP Analyzer",
  description: "RFP를 분석해 제안 기초자료를 엑셀로 정리합니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
