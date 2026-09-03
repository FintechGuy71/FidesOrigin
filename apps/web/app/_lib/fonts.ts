import { Space_Grotesk, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

/* next/font 变量统一以 -nf 结尾。
   原因：消费名是 --font-sans / --font-serif / --font-mono
   （见 css/fio-design-system.css）。若 next/font 也用 --font-sans，
   :root 上就会出现 `--font-sans: var(--font-sans), …` 的自引用循环，
   该自定义属性 invalid at computed-value time，整条字体声明连同兜底链
   一起失效（历史 bug：Space Grotesk 被下载却从未生效，标题全部回落正文无衬线体）。 */
export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-nf",
  display: "swap",
});

export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans-nf",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-nf",
  display: "swap",
});

/** 挂在 <body> 上的字体变量类名，供各个 root layout 复用。 */
export const fontVariableClassNames = [
  spaceGrotesk.variable,
  plusJakarta.variable,
  jetbrainsMono.variable,
].join(" ");
