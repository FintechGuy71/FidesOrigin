import type { Dict } from "@/i18n/dictionaries/en";

type Feature = { number: string; title: string; subtitle: string; description: string; tags: string[]; visual: string };

function Radar({ label }: { label: string }) {
  return (
    <div className="radar-visual">
      <svg viewBox="0 0 260 260" role="img" aria-label={label}>
        <g transform="translate(30 30)" fill="none" stroke="currentColor">
          {[35, 65, 95].map((radius) => <circle key={radius} cx="100" cy="100" r={radius} strokeWidth="0.7" opacity="0.35" />)}
          {[0, 60, 120, 180, 240, 300].map((angle) => {
            const radian = (angle * Math.PI) / 180;
            return <line key={angle} x1="100" y1="100" x2={100 + 95 * Math.cos(radian)} y2={100 + 95 * Math.sin(radian)} strokeWidth="0.6" opacity="0.3" />;
          })}
          <polygon points="100,39 158,73 143,143 69,155 42,84" fill="var(--p-sun)" fillOpacity="0.5" strokeWidth="1.4" />
          <line x1="100" y1="100" x2="195" y2="100" strokeWidth="1.4" className="feature-radar-sweep" />
          <circle cx="100" cy="100" r="4" fill="currentColor" stroke="none" />
        </g>
      </svg>
      <span>{label}</span>
    </div>
  );
}

function Policy({ label }: { label: string }) {
  const rules = [["KYC Verified", "PASS"], ["Tx Limit ≤ $10K", "PASS"], ["Risk Score ≤ 3", "PASS"], ["Execute Transfer", "→"]];
  return (
    <div className="policy-visual">
      <div>{rules.map(([rule, status]) => <div className="policy-rule" key={rule}><span>{rule}</span><strong>{status}</strong></div>)}</div>
      <p>{label}</p>
    </div>
  );
}

function Audit({ label }: { label: string }) {
  return (
    <div className="audit-visual">
      <svg viewBox="0 0 400 210" role="img" aria-label={label}>
        <g fontFamily="var(--font-mono)" fontSize="11" fill="currentColor">
          {[45, 95, 145].map((y, index) => <g key={y}><circle cx="28" cy={y} r="5" fill="var(--p-black)" />{index < 2 && <line x1="28" y1={y + 5} x2="28" y2={y + 45} stroke="currentColor" />}<text x="48" y={y + 4}>BLOCK #{120000 + index * 1500}</text><text x="48" y={y + 22} opacity="0.55">FINAL STATE · VERIFIED</text></g>)}
        </g>
        <g transform="translate(270 22)" fill="none" stroke="currentColor">
          <path d="M60 5 110 30v55c0 42-24 67-50 82-26-15-50-40-50-82V30Z" strokeWidth="1.5" />
          <path d="m35 82 18 18 35-45" strokeWidth="3" />
        </g>
      </svg>
      <span>{label}</span>
    </div>
  );
}

export default function Features({ d }: { d: Dict["home"]["features"] }) {
  const features: Feature[] = [
    { number: "01", title: d.f1Title, subtitle: d.f1Sub, description: d.f1Desc, tags: ["Chainalysis", "Elliptic", "OFAC"], visual: "radar" },
    { number: "02", title: d.f2Title, subtitle: d.f2Sub, description: d.f2Desc, tags: ["KYC/AML", "Tx Limits", "Timelock"], visual: "chain" },
    { number: "03", title: d.f3Title, subtitle: d.f3Sub, description: d.f3Desc, tags: ["SEC", "HKMA", "MiCA"], visual: "shield" },
  ];

  return (
    <section id="features" className="home-section features-section">
      <div className="home-shell">
        <div className="home-section-head features-head">
          <p className="home-caption">{d.caption}</p>
          <h2>{d.title}</h2>
          <p className="home-section-body">{d.body}</p>
        </div>
        <div className="capability-list">
          {features.map((feature, index) => (
            <article className="capability-row" key={feature.number}>
              <div className="capability-copy">
                <span className="capability-number">{feature.number}</span>
                <h3>{feature.title}</h3>
                <p className="capability-subtitle">{feature.subtitle}</p>
                <p className="capability-description">{feature.description}</p>
                <ul>{feature.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
              </div>
              <div className={`capability-visual capability-tone-${index + 1}`}>
                {feature.visual === "radar" && <Radar label={d.radarCaption} />}
                {feature.visual === "chain" && <Policy label={d.policyCaption} />}
                {feature.visual === "shield" && <Audit label={d.shieldCaption} />}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
