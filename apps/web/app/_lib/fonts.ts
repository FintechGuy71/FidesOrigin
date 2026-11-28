import { Inter, JetBrains_Mono } from "next/font/google";

/* A single neo-grotesk voice for interface and display, with a mono data face.
   next/font self-hosts both files; the CJK stacks live in the design system. */
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans-nf",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-nf",
  display: "swap",
});

export const fontVariableClassNames = [inter.variable, jetbrainsMono.variable].join(" ");
