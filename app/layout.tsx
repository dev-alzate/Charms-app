import type { Metadata, Viewport } from "next";
import "./globals.css";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "Charms App";

export const metadata: Metadata = {
  title: `${businessName} — POS`,
  description: "Sistema POS para venta de charms personalizados en ferias",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: businessName,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#7C3AED",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
