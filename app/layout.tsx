import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${protocol}://${host}` : "https://gestao-riscos-unificado.felipe-galanbaptiste.chatgpt.site";

  return {
    title: "Gestão de Riscos — Gerador Completo",
    description: "Gere apresentações comerciais personalizadas com cálculo patrimonial e colagem em massa dos valores de resgate.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Gestão de Riscos",
      description: "Gerador completo de apresentações",
      images: [`${baseUrl}/og.png`],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Gestão de Riscos",
      description: "Gerador completo de apresentações",
      images: [`${baseUrl}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
