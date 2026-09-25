import Link from "next/link";

/* ================================================================
   BLOG NAV（R11-M7）— 文章页导航闭环：返回列表 + 上/下一篇。
   纯静态无状态组件；文案与 prev/next 由各文章页以本语言硬编码传入。
   样式在 css/legacy.css 的 .blog-nav-*（共享）。
   ================================================================ */

export default function BlogNav({
  back,
  prevLabel,
  nextLabel,
  prev,
  next,
}: {
  back: string;
  prevLabel: string;
  nextLabel: string;
  prev?: { href: string; title: string };
  next?: { href: string; title: string };
}) {
  return (
    <div className="blog-nav">
      <Link href="/blog" className="blog-nav-back" prefetch={false}>
        ← {back}
      </Link>
      <div className="blog-nav-row">
        {prev ? (
          <Link href={prev.href} className="blog-nav-card" prefetch={false}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.6875rem",
                letterSpacing: "0.1em",
                opacity: 0.7,
              }}
            >
              ← {prevLabel}
            </span>
            <span>{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={next.href} className="blog-nav-card" prefetch={false}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.6875rem",
                letterSpacing: "0.1em",
                opacity: 0.7,
              }}
            >
              {nextLabel} →
            </span>
            <span>{next.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
