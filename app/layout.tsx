import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Duplex — Listen. Understand.",
  description: "Follow native podcasts one sentence and one literal translation at a time.",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
