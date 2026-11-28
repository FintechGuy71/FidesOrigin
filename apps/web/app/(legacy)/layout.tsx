import { fontVariableClassNames } from "../_lib/fonts";
import { jsonLd, siteMetadata } from "../_lib/site";
import "@/css/style.css";
import "@/css/legacy.css";
import "@/css/legacy-world.css";

export const metadata = siteMetadata;

export default function LegacyRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script dangerouslySetInnerHTML={{ __html: 'document.documentElement.classList.add("js");' }} />
      </head>
      <body className={`${fontVariableClassNames} font-sans antialiased`}>{children}</body>
    </html>
  );
}
