import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MessMate | Smart campus dining",
  description:
    "Plan meals, verify attendance and measure food waste with one shared system.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
