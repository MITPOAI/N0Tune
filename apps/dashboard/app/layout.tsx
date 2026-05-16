import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "N0Tune Dashboard",
  description: "Phase 0 dashboard for N0Tune.",
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
