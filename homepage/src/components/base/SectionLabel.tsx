import type { ReactNode } from "react";

interface SectionLabelProps {
  children: ReactNode;
  className?: string;
}

export default function SectionLabel({ children, className = "" }: SectionLabelProps) {
  return (
    <div
      className={`flex items-center gap-3 text-[15px] font-semibold tracking-tight text-primary-700 ${className}`}
    >
      <span aria-hidden="true" className="h-[2px] w-7 rounded-full bg-primary-500" />
      {children}
    </div>
  );
}