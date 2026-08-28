import { Space_Grotesk, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import Script from "next/script";

import LangSetter from "./components/LangSetter";
import "../css/style.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL("https://fidesorigin.com"),
  title: "FidesOrigin — Programmable On-Chain Compliance",
  description:
    "Execution-grade programmable compliance protocol for tokenized assets, stablecoins, and DeFi. Real-time risk control, autonomous policy enforcement, immutable audit trails.",
  openGraph: {
    title: "FidesOrigin — Programmable On-Chain Compliance",
    description:
      "Execution-grade programmable compliance protocol for on-chain finance.",
    type: "website",
    images: ["https://fidesorigin.com/brand/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    site: "@fidesorigin",
    images: ["https://fidesorigin.com/brand/og-image.png"],
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
        className={`${spaceGrotesk.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <LangSetter />
        {children}
        {/* Privacy-friendly analytics (CSP already allows plausible.io) */}
        <Script
          defer
          data-domain="fidesorigin.com"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
