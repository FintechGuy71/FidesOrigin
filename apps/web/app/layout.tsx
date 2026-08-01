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

/** JSON-LD structured data for SEO */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "FidesOrigin",
      url: "https://fidesorigin.com",
      logo: "https://fidesorigin.com/brand/logo-dark-icon.png",
      description: "Programmable on-chain compliance protocol for tokenized assets and DeFi.",
    },
    {
      "@type": "WebSite",
      url: "https://fidesorigin.com",
      name: "FidesOrigin",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://fidesorigin.com/?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      name: "FidesOrigin Protocol",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web3",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable} font-sans antialiased`}
        style={{
          background: "var(--fio-ink, #0a0e1a)",
          color: "var(--fio-text, #f1f5f9)",
        }}
      >
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          Skip to main content
        </a>
        <div id="main-content" className="flex min-h-screen flex-col overflow-hidden supports-[overflow:clip]:overflow-clip">
          <LangSetter />
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
