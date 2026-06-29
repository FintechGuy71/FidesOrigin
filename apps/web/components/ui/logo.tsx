import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 shrink-0" aria-label="FidesOrigin">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
        F
      </div>
      <span className="font-semibold text-white text-lg">FidesOrigin</span>
    </Link>
  );
}
