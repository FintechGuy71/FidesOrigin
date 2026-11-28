import type { Dict } from "@/i18n/dictionaries/en";

export default function Testimonials({ d }: { d: Dict["home"]["journey"] }) {
  const steps = [
    { number: "01", title: d.j1Title, description: d.j1Desc, detail: d.j1Detail },
    { number: "02", title: d.j2Title, description: d.j2Desc, detail: d.j2Detail },
    { number: "03", title: d.j3Title, description: d.j3Desc, detail: d.j3Detail },
    { number: "04", title: d.j4Title, description: d.j4Desc, detail: d.j4Detail },
  ];

  return (
    <section className="home-section journey-section">
      <div className="home-shell">
        <div className="home-section-head journey-head">
          <p className="home-caption">{d.caption}</p>
          <h2>{d.title}</h2>
          <p className="home-section-body">{d.body}</p>
        </div>
        <ol className="journey-track" aria-label={d.title} tabIndex={0}>
          {steps.map((step) => (
            <li key={step.number}>
              <span className="journey-number">{step.number}</span>
              <div className="journey-handle" aria-hidden="true" />
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <small>{step.detail}</small>
            </li>
          ))}
        </ol>
        <div className="journey-quote">
          <blockquote>“{d.quote}”</blockquote>
          <p><strong>{d.quoteName}</strong><span>{d.quoteRole}</span></p>
        </div>
      </div>
    </section>
  );
}
