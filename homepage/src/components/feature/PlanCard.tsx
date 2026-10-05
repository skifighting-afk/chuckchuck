import { Link } from "react-router-dom";
import type { Plan } from "@/mocks/site";

interface PlanCardProps {
  plan: Plan;
}

export default function PlanCard({ plan }: PlanCardProps) {
  // 사이트 안의 사전 체험(/try)은 내부 이동(Link), 외부 유료 가입은 새 탭 없는 a 태그로 보낸다.
  const isInternal = plan.url.startsWith("/");
  const ctaClass = `flex min-h-[56px] items-center justify-center whitespace-nowrap rounded-md px-6 text-[17px] font-semibold transition-colors ${
    plan.highlight
      ? "bg-primary-600 text-background-50 hover:bg-primary-700"
      : "border border-foreground-900 text-foreground-950 hover:bg-foreground-950 hover:text-background-50"
  }`;

  return (
    <div
      className={`flex h-full flex-col rounded-lg border p-6 transition-colors duration-200 md:p-7 ${
        plan.highlight
          ? "border-primary-400 bg-primary-50/60 hover:border-primary-500"
          : "border-background-200 bg-background-50 hover:border-primary-300"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading text-[22px] font-bold text-foreground-950">{plan.name}</h3>
        {plan.highlight ? (
          <span className="rounded-full bg-primary-600 px-3 py-1 text-[14px] font-semibold text-background-50">
            QR 출퇴근 포함
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[16px] leading-relaxed text-foreground-700">{plan.tagline}</p>

      <div className="mt-5 border-t border-background-200 pt-5">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-heading text-[30px] font-bold tracking-tight text-foreground-950">
            {plan.price}
          </span>
          {plan.priceNote ? (
            <span className="text-[15px] text-foreground-600">{plan.priceNote}</span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[16px] font-medium text-foreground-800">{plan.total}</p>
        {plan.extra ? (
          <p className="mt-1 text-[15px] text-foreground-700">{plan.extra}</p>
        ) : null}
        <p className="mt-3 inline-flex rounded-md bg-secondary-100 px-3 py-1.5 text-[15px] font-medium text-secondary-900">
          {plan.limit}
        </p>
      </div>

      <ul className="mt-6 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li
            key={feature.label}
            className="flex items-start gap-2.5 text-[16px] leading-relaxed text-foreground-800"
          >
            <i className="ri-check-line mt-0.5 flex-none text-[18px] text-primary-600" />
            <span className="flex flex-wrap items-center gap-2">
              {feature.label}
              {feature.preview ? (
                <span className="rounded-full border border-background-300 px-2 py-0.5 text-[13px] text-foreground-600">
                  사전 체험 제공
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-7">
        {isInternal ? (
          <Link to={plan.url} className={ctaClass}>
            {plan.cta}
          </Link>
        ) : (
          <a href={plan.url} target="_top" rel="noopener noreferrer" className={ctaClass}>
            {plan.cta}
          </a>
        )}
        <p className="mt-3 text-[15px] leading-relaxed text-foreground-700">{plan.note}</p>
      </div>
    </div>
  );
}