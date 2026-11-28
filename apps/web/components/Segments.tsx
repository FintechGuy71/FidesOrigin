import type { Dict } from "@/i18n/dictionaries/en";

export default function Segments({ d }: { d: Dict["home"]["segments"] }) {
  const segments = [
    { number: "S.01", title: d.s1Title, description: d.s1Desc, points: d.s1Points },
    { number: "S.02", title: d.s2Title, description: d.s2Desc, points: d.s2Points },
    { number: "S.03", title: d.s3Title, description: d.s3Desc, points: d.s3Points },
  ];

  return (
    <section id="segments" className="home-section segments-section">
      <div className="home-shell">
        <div className="home-section-head segments-head">
          <p className="home-caption">{d.caption}</p>
          <h2>{d.title}</h2>
          <p className="home-section-body">{d.body}</p>
        </div>
        <div className="segment-index">
          {segments.map((segment) => (
            <article key={segment.number}>
              <span>{segment.number}</span>
              <h3>{segment.title}</h3>
              <p>{segment.description}</p>
              <ul>{segment.points.map((point) => <li key={point}>{point}</li>)}</ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
