import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 shrink-0" aria-label="FidesOrigin">
      <img
        src="/brand/logo-dark-icon.png"
        alt="FidesOrigin"
        width="32"
        height="32"
        className="rounded-lg"
      />
      <span className="font-semibold text-white text-lg">FidesOrigin</span>
    </Link>
  );
}
