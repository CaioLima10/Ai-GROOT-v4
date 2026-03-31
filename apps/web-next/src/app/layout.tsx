import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GIOM Workspace",
  description: "Frontend oficial do GIOM em Next.js, pronto para producao e operacao diaria.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className="h-full antialiased">
      <body suppressHydrationWarning className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
