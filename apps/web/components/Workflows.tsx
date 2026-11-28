import type { Dict } from "@/i18n/dictionaries/en";

export default function Workflows({ d }: { d: Dict["home"]["workflows"] }) {
  const steps = [
    { number: "001", label: d.step1Label, sub: d.step1Sub },
    { number: "002", label: d.step2Label, sub: d.step2Sub },
    { number: "003", label: d.step3Label, sub: d.step3Sub },
  ];
  const nodes = [d.flowNode1, d.flowNode2, d.flowNode3, d.flowNode4];

  return (
    <section id="capabilities" className="home-section workflow-section">
      <div className="home-shell">
        <div className="home-section-head">
          <p className="home-caption">{d.caption}</p>
          <h2>{d.title}</h2>
          <p className="home-section-body">{d.body}</p>
        </div>

        <ol className="workflow-steps">
          {steps.map((step) => (
            <li key={step.number}>
              <span className="workflow-number">{step.number}</span>
              <div className="workflow-node" aria-hidden="true" />
              <h3>{step.label}</h3>
              <p>{step.sub}</p>
            </li>
          ))}
        </ol>

        <div className="workflow-ledger">
          <div className="workflow-ledger-head">
            <span>{d.flowLabel}</span>
            <strong><i aria-hidden="true" />{d.flowLive}</strong>
          </div>
          <ol>
            {nodes.map((node, index) => (
              <li key={node}>
                <span>{node}</span>
                {index < nodes.length - 1 && <svg viewBox="0 0 32 12" fill="none" aria-hidden="true"><path d="M0 6h29M24 1l5 5-5 5" stroke="currentColor" /></svg>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
