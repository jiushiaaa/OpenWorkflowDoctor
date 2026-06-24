import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenWorkflowDoctor",
  description: "Workflow Reliability IDE for existing n8n workflows"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
