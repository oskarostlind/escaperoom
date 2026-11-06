// app/layout.tsx
import "./globals.css"; // NOTE: path from /app to /global.css
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Glitter & Glamour – Escaperoom",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
