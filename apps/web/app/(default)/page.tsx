import Cta from "@/components/Cta";
import Features from "@/components/Features";
import Hero from "@/components/HeroHome";
import Testimonials from "@/components/Testimonials";
import Trust from "@/components/Trust";
import Workflows from "@/components/Workflows";

export default function Home() {
  return (
    <>
      <Hero />
      <Workflows />
      <Features />
      <Trust />
      <Testimonials />
      <Cta />
    </>
  );
}
