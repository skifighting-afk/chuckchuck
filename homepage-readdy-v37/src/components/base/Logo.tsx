import { Link } from "react-router-dom";
import { BRAND } from "@/mocks/site";

interface LogoProps {
  tone?: "light" | "dark";
  className?: string;
}

export default function Logo({ tone = "light", className = "" }: LogoProps) {
  const main = tone === "dark" ? "text-background-50" : "text-foreground-950";
  const sub = tone === "dark" ? "text-background-300" : "text-foreground-500";

  return (
    <Link
      to="/"
      className={`group flex min-w-0 items-center gap-2.5 ${className}`}
      aria-label={`${BRAND.name} 홈으로 이동`}
    >
      <span className="relative flex h-9 w-9 flex-none items-center justify-center rounded-md bg-primary-600">
        <span
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center text-background-50"
        >
          <i className="ri-check-double-line text-[21px] leading-none" />
        </span>
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent-400"
        />
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={`truncate font-heading text-[17px] font-bold tracking-tight sm:text-[18px] ${main}`}
        >
          {BRAND.name}
        </span>
        <span className={`mt-1 hidden font-label text-[10px] font-medium ${sub} sm:block`}>
          {BRAND.aliasLine}
        </span>
      </span>
    </Link>
  );
}