import "./globals.css";
import type { Metadata } from "next";
import { ThemeScript } from "@/components/theme-script";

export const metadata: Metadata = {
  title: "PrivacyGuard Analytics",
  description: "Privacy-aware healthcare analytics demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
