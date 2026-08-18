import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
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
  // Systemet brukes på nettbrett ute i anlegget
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

/** Oversetter det lagrede valget til klassen stilarket ser etter. */
function temaKlasse(valg: string | undefined): string {
  if (valg === "lys") return "lys";
  if (valg === "mork") return "dark";
  return ""; // ingen klasse = følg operativsystemet
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Temaet leses på serveren slik at riktig farge ligger i HTML-en fra
  // første byte. Uten dette blinker siden hvit før JavaScript rekker å
  // sette klassen.
  const valgtTema = (await cookies()).get("tema")?.value;

  return (
    <html
      lang="nb"
      className={`${inter.variable} ${temaKlasse(valgtTema)} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
