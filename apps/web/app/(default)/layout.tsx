import HomeChrome from "@/components/home-chrome";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HomeChrome lang="en">{children}</HomeChrome>;
}
