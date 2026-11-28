/* Brand book — v4 Editorial Verification 品牌资产页（EN-only，对客/对媒体） */

const PAGE_CSS = `
    .brand-hero { padding: 140px 0 60px; }
    .brand-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 40px; }
    @media (max-width: 900px) { .brand-grid { grid-template-columns: 1fr; } }
    .brand-panel {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 28px;
    }
    .brand-panel h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 16px; color: var(--text); }
    .brand-logo-row { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; }
    .brand-logo-cell { text-align: center; }
    .brand-logo-cell img { margin: 0 auto 8px; display: block; }
    .brand-logo-cell .lbl { font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted); }
    .swatch-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    @media (max-width: 600px) { .swatch-grid { grid-template-columns: repeat(2, 1fr); } }
    .swatch { border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
    .swatch .chip { height: 56px; }
    .swatch .meta { padding: 8px 10px; }
    .swatch .name { font-size: 0.75rem; font-weight: 600; color: var(--text); }
    .swatch .hex { font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted); }
    .type-row { padding: 14px 0; border-bottom: 1px solid var(--fio-border-hairline); }
    .type-row:last-child { border-bottom: none; }
    .type-row .spec { font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; }
    .brand-download { display: inline-flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
    .brand-download a {
      font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent);
      border: 1px solid var(--accent-line); border-radius: var(--radius-sm);
      padding: 6px 12px; transition: all 0.2s;
    }
    .brand-download a:hover { background: var(--accent-dim); }
    .motif-demo {
      height: 140px; position: relative; overflow: hidden;
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      /* [AUDIT FIX 2026-09-25 R9-A5] 中心盾形徽标线条（与 Hero seal 同语言）：
         此前仅四角刻线，预览框读作"空白"（OG 卡为下载资产不在框内展示）。 */
      display: flex; align-items: center; justify-content: center;
      background:
        linear-gradient(var(--accent), var(--accent)) left 8px top 8px / 10px 1px,
        linear-gradient(var(--accent), var(--accent)) left 8px top 8px / 1px 10px,
        linear-gradient(var(--accent), var(--accent)) right 8px top 8px / 10px 1px,
        linear-gradient(var(--accent), var(--accent)) right 8px top 8px / 1px 10px,
        linear-gradient(var(--accent), var(--accent)) left 8px bottom 8px / 10px 1px,
        linear-gradient(var(--accent), var(--accent)) left 8px bottom 8px / 1px 10px,
        linear-gradient(var(--accent), var(--accent)) right 8px bottom 8px / 10px 1px,
        linear-gradient(var(--accent), var(--accent)) right 8px bottom 8px / 1px 10px,
        radial-gradient(ellipse 70% 60% at 50% 0%, var(--accent-glow) 0%, transparent 65%);
      background-repeat: no-repeat;
    }
    .motif-demo::before {
      content: "";
      width: 44px; height: 52px;
      border: 1px solid var(--accent);
      border-radius: 2px 2px 10px 10px / 2px 2px 16px 16px;
      opacity: 0.75;
    }
    .motif-demo::after {
      content: "";
      position: absolute;
      left: 50%; top: 50%;
      width: 16px; height: 9px;
      margin: -4.5px 0 0 -8px;   /* 勾形上沿对齐盾牌中心略上 */
      border-left: 1.5px solid var(--gold-bright);
      border-bottom: 1.5px solid var(--gold-bright);
      transform: rotate(-45deg);
      opacity: 0.9;
    }
`;

const SWATCHES = [
  { name: "Sage Paper", hex: "#dddec9", token: "--fio-ink" },
  { name: "Paper White", hex: "#ffffff", token: "--fio-surface" },
  { name: "Sun Action", hex: "#ffe600", token: "--fio-gold" },
  { name: "Sky Data", hex: "#aae2ff", token: "--fio-steel" },
  { name: "Soft Cream", hex: "#fcedb1", token: "--p-cream" },
  { name: "Ink Black", hex: "#000000", token: "--p-black" },
  { name: "Data Green", hex: "#00bb7f", token: "--fio-success" },
  { name: "Risk Red", hex: "#fb2c36", token: "--fio-danger" },
];

export default function ContentBrandTW() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

      <section className="brand-hero">
        <div className="container">
          <p className="micro">品牌</p>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 4.5vw, 3.2rem)" }}>
            FidesOrigin <span>品牌資產</span>
          </h1>
          <p className="lead" style={{ maxWidth: "640px", marginTop: "20px" }}>
            Editorial Verification（編輯式驗證）視覺體系——鼠尾草紙面、天藍資料區、明黃行動點與清晰的墨跡網格。
            在媒體報導、合作或整合中引用 FidesOrigin 時，請使用這些當前資產。
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="brand-grid">
            {/* Logo */}
            <div className="brand-panel">
              <h2>標識</h2>
              <div className="brand-logo-row">
                <div className="brand-logo-cell">
                  <picture><source srcSet="/brand/logo-dark-icon.webp" type="image/webp" /><img src="/brand/logo-dark-icon.png" loading="lazy" alt="FidesOrigin icon" width={56} height={56}  /></picture>
                  <div className="lbl">ICON</div>
                </div>
                <div className="brand-logo-cell">
                  <picture><source srcSet="/brand/logo-dark-full.webp" type="image/webp" /><img src="/brand/logo-dark-full.png" loading="lazy" alt="FidesOrigin full logo" height={40} width={160} style={{ objectFit: "contain" }}  /></picture>
                  <div className="lbl">FULL · DARK BG</div>
                </div>
              </div>
              <div className="brand-download">
                <a href="/brand/logo-dark-icon.png" download>圖標 PNG</a>
                <a href="/brand/logo-dark-icon.svg" download>Icon SVG</a>
                <a href="/brand/logo-dark-full.png" download>完整 PNG</a>
                <a href="/brand/logo-dark-stacked.png" download>堆疊 PNG</a>
              </div>
            </div>

            {/* Palette */}
            <div className="brand-panel">
              <h2>色板</h2>
              <div className="swatch-grid">
                {SWATCHES.map((s) => (
                  <div className="swatch" key={s.token}>
                    <div className="chip" style={{ background: s.hex }} />
                    <div className="meta">
                      <div className="name">{s.name}</div>
                      <div className="hex">{s.hex}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div className="brand-panel">
              <h2>字體</h2>
              <div className="type-row">
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "1.6rem", fontWeight: 500, color: "var(--text)" }}>
                  Inter — 展示與正文
                </div>
                <div className="spec">標題與介面 · 流式字號 · 400/500/600</div>
              </div>
              <div className="type-row">
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "1rem", color: "var(--text)" }}>
                  PingFang / Noto — 中文系統字體堆疊
                </div>
                <div className="spec">本地化正文 · 顯式中文回退</div>
              </div>
              <div className="type-row">
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--text)" }}>
                  JetBrains Mono — 5,348 筆記錄 · HTTP 200
                </div>
                <div className="spec">指標 · 標籤 · 等寬數字 · 已驗證即時資料</div>
              </div>
            </div>

            {/* Motif */}
            <div className="brand-panel">
              <h2>母題 — 編輯式驗證</h2>
              <div className="motif-demo" />
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "16px", lineHeight: 1.7 }}>
                可見墨跡規則、功能色區與驗證網絡——每個圖形元素都承載證據，無意義不裝飾。
              </p>
              <div className="brand-download">
                <a href="/brand/og-image.png" download>OG 卡 PNG</a>
                <a href="/brand/og-image.svg" download>OG Card SVG</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
