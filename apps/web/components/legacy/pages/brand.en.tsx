/* Brand book — v4 Ledger Precision 品牌资产页（EN-only，对客/对媒体） */

const PAGE_CSS = `
    .brand-hero { padding: 140px 0 60px; }
    .brand-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 40px; }
    @media (max-width: 900px) { .brand-grid { grid-template-columns: 1fr; } }
    .brand-panel {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
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
  { name: "Ink", hex: "#0a141f", token: "--fio-ink" },
  { name: "Surface Elevated", hex: "#162638", token: "--fio-surface-2" },
  { name: "Bronze", hex: "#af915f", token: "--fio-gold" },
  { name: "Cream", hex: "#fce1b6", token: "--fio-cream" },
  { name: "Light Bronze", hex: "#e3c892", token: "--fio-accent" },
  { name: "Steel", hex: "#7a94ab", token: "--fio-steel" },
  { name: "Warm White", hex: "#f4f1e9", token: "--fio-text" },
  { name: "Warm Grey", hex: "#98917f", token: "--fio-text-3" },
];

export default function ContentBrandEN() {
  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + PAGE_CSS + "}" }} />

      <section className="brand-hero">
        <div className="container">
          <p className="micro">Brand</p>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 4.5vw, 3.2rem)" }}>
            FidesOrigin <span>brand assets</span>
          </h1>
          <p className="lead" style={{ maxWidth: "640px", marginTop: "20px" }}>
            The Ledger Precision identity system — deep navy, burnished bronze, and technical-drawing discipline.
            Use these assets when featuring FidesOrigin in press, partnerships, or integrations.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="brand-grid">
            {/* Logo */}
            <div className="brand-panel">
              <h3>Logo</h3>
              <div className="brand-logo-row">
                <div className="brand-logo-cell">
                  <img src="/brand/logo-dark-icon.png" loading="lazy" alt="FidesOrigin icon" width={56} height={56} />
                  <div className="lbl">ICON</div>
                </div>
                <div className="brand-logo-cell">
                  <img src="/brand/logo-dark-full.png" loading="lazy" alt="FidesOrigin full logo" height={40} width={160} style={{ objectFit: "contain" }} />
                  <div className="lbl">FULL · DARK BG</div>
                </div>
              </div>
              <div className="brand-download">
                <a href="/brand/logo-dark-icon.png" download>Icon PNG</a>
                <a href="/brand/logo-dark-icon.svg" download>Icon SVG</a>
                <a href="/brand/logo-dark-full.png" download>Full PNG</a>
                <a href="/brand/logo-dark-stacked.png" download>Stacked PNG</a>
              </div>
            </div>

            {/* Palette */}
            <div className="brand-panel">
              <h3>Palette</h3>
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
              <h3>Typography</h3>
              <div className="type-row">
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem", fontWeight: 500, color: "var(--text)" }}>
                  Fraunces — Display
                </div>
                <div className="spec">Headlines · clamp(2.4rem, 5.4vw, 4.6rem) · 500</div>
              </div>
              <div className="type-row">
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "1rem", color: "var(--text)" }}>
                  Plus Jakarta Sans — Body
                </div>
                <div className="spec">UI & body · 400/500 · CJK fallback PingFang / Noto</div>
              </div>
              <div className="type-row">
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--text)" }}>
                  JetBrains Mono — Sample: 20,645 addresses · &lt;50ms latency
                </div>
                <div className="spec">Metrics · labels · tabular numerals · uppercase tracking</div>
              </div>
            </div>

            {/* Motif */}
            <div className="brand-panel">
              <h3>Motif — Ledger Precision</h3>
              <div className="motif-demo" />
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "16px", lineHeight: 1.7 }}>
                Corner tick marks, hairline rules, and the compliance mesh — every graphic element carries information.
                No decoration without meaning.
              </p>
              <div className="brand-download">
                <a href="/brand/og-image.png" download>OG Card PNG</a>
                <a href="/brand/og-image.svg" download>OG Card SVG</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
