import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import Header from "@/components/ui/header";
import LangSetter from "./components/LangSetter";
import "../css/style.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata = {
  title: "FidesOrigin — Programmable On-Chain Compliance",
  description:
    "Execution-grade programmable compliance protocol for tokenized assets, stablecoins, and DeFi. Real-time risk control, autonomous policy enforcement, immutable audit trails.",
  openGraph: {
    title: "FidesOrigin — Programmable On-Chain Compliance",
    description:
      "Execution-grade programmable compliance protocol for on-chain finance.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable} font-sans antialiased`}
        style={{
          background: "var(--fio-ink, #0a0e1a)",
          color: "var(--fio-text, #f1f5f9)",
        }}
      >
        <div className="flex min-h-screen flex-col overflow-hidden supports-[overflow:clip]:overflow-clip">
          <LangSetter />
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
