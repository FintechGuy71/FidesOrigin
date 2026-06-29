"use client";

/* ================================================================
   CTA v3 — Pricing cards. Clear conversion funnel.
   ================================================================ */

const plans = [
  {
    name: "Open Source",
    price: "$0",
    period: "forever",
    desc: "Self-hosted. Full source code. Community support.",
    features: [
      "All core contracts",
      "Risk registry & oracle",
      "Policy engine",
      "Community Discord",
    ],
    cta: "View on GitHub",
    href: "https://github.com/FintechGuy71/FidesOrigin",
    external: true,
    featured: false,
  },
  {
    name: "Managed",
    price: "Contact Us",
    period: "custom pricing",
    desc: "We run the infrastructure. You focus on product.",
    features: [
      "Managed node hosting",
      "SLA guarantee",
      "Custom policy rules",
      "Priority support",
      "HKMA compliance review",
    ],
    cta: "Request Demo",
    href: "mailto:contact@fidesorigin.com",
    external: false,
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "bespoke engagement",
    desc: "Full customization, dedicated team, white-glove onboarding.",
    features: [
      "Dedicated SRE team",
      "Custom chain integration",
      "Private risk data sources",
      "Regulatory liaison",
      "Source code escrow",
    ],
    cta: "Talk to Sales",
    href: "mailto:contact@fidesorigin.com",
    external: false,
    featured: false,
  },
];

export default function Cta() {
  return (
    <section
      style={{
        background:
          "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(139,126,200,0.04) 0%, transparent 70%), var(--fio-ink-soft)",
      }}
    >
      <div className="mx-auto max-w-6xl px-4 py-28 sm:px-6 md:py-36">
        {/* Header */}
        <div className="mx-auto max-w-2xl pb-20 text-center md:pb-28">
          <div className="fio-caption mb-4" data-aos="fade-up">
            Pricing
          </div>
          <h2
            className="fio-heading-lg mb-5"
            style={{ color: "var(--fio-text)" }}
            data-aos="fade-up"
            data-aos-delay={100}
          >
            Choose Your Path
          </h2>
          <p className="fio-body-lg" data-aos="fade-up" data-aos-delay={200}>
            开源免费使用，托管服务按需定价，企业级方案量身打造。
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid gap-6 md:grid-cols-3" data-aos="fade-up" data-aos-delay={300}>
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="relative overflow-hidden rounded-lg"
              style={{
                background: plan.featured
                  ? "rgba(139,126,200,0.03)"
                  : "rgba(255,255,255,0.01)",
                border: plan.featured
                  ? "1px solid rgba(139,126,200,0.15)"
                  : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Featured badge */}
              {plan.featured && (
                <div
                  className="absolute right-0 top-0 rounded-bl-md px-3 py-1 text-[0.6rem] font-mono font-medium"
                  style={{
                    background: "rgba(139,126,200,0.1)",
                    color: "var(--fio-accent)",
                  }}
                >
                  RECOMMENDED
                </div>
              )}

              <div className="p-8">
                {/* Plan name */}
                <div
                  className="mb-2 text-xs font-mono uppercase tracking-wider"
                  style={{ color: "var(--fio-text-3)" }}
                >
                  {plan.name}
                </div>

                {/* Price */}
                <div className="mb-1 text-3xl font-semibold tracking-tight" style={{ color: "var(--fio-text)" }}>
                  {plan.price}
                </div>
                <div className="mb-6 text-xs" style={{ color: "var(--fio-text-3)", fontFamily: "var(--font-mono)" }}>
                  {plan.period}
                </div>

                {/* Desc */}
                <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--fio-text-2)" }}>
                  {plan.desc}
                </p>

                {/* Features */}
                <ul className="mb-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--fio-text-2)" }}>
                      <svg
                        className="mt-0.5 h-4 w-4 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        style={{ color: "var(--fio-gold)" }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <a
                  href={plan.href}
                  target={plan.external ? "_blank" : undefined}
                  rel={plan.external ? "noopener noreferrer" : undefined}
                  className="fio-btn block w-full text-center"
                  style={{
                    background: plan.featured ? "var(--fio-accent)" : "transparent",
                    color: plan.featured ? "var(--fio-ink)" : "var(--fio-text)",
                    border: plan.featured ? "none" : "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {plan.cta}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div className="mt-14 text-center" data-aos="fade-up" data-aos-delay={400}>
          <p className="text-sm" style={{ color: "var(--fio-text-3)" }}>
            All plans include core compliance contracts, risk registry, and audit trail.
            {" "}
            <a
              href="mailto:contact@fidesorigin.com"
              className="underline underline-offset-2 transition-colors"
              style={{ color: "var(--fio-accent)" }}
            >
              Contact us
            </a>
            {" "}
            for custom requirements.
          </p>
        </div>
      </div>
    </section>
  );
}
