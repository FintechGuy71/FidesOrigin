import type { Metadata } from "next";
import {
  legacyMetadata,
  legacyStaticParams,
  renderLegacyPage,
} from "@/i18n/legacy-route";

/* EN legacy pages: /pricing, /docs/api, /blog/..., etc. */

export const dynamicParams = false;

export function generateStaticParams() {
  return legacyStaticParams("en");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return legacyMetadata("en", slug);
}

export default async function LegacyEnPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  return renderLegacyPage("en", slug);
}
