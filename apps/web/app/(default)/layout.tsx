import HomeChrome from "@/components/home-chrome";
import { fontVariableClassNames } from "../_lib/fonts";
import { jsonLd, siteMetadata } from "../_lib/site";
import "@/css/style.css";

export const metadata = siteMetadata;

export default function DefaultRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script dangerouslySetInnerHTML={{ __html: 'document.documentElement.classList.add("js");' }} />
      </head>
      <body className={`${fontVariableClassNames} font-sans antialiased`}>
        <HomeChrome lang="en">{children}</HomeChrome>
      </body>
    </html>
  );
}
