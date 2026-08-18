import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Vedlikeholdssystem",
    template: "%s · Vedlikeholdssystem",
  },
  description:
    "Arbeidsordre, anleggsstruktur, reservedeler og forebyggende vedlikehold — samlet på ett sted.",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  // Systemet brukes på nettbrett ute i anlegget
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nb" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
