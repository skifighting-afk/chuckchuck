import type { ReactNode } from "react";

interface ScreenFrameProps {
  title: string;
  meta: string;
  action?: ReactNode;
  children: ReactNode;
}

export default function ScreenFrame({ title, meta, action, children }: ScreenFrameProps) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-background-200 bg-background-50 px-4 py-3.5 md:px-6">
        <div className="min-w-0">
          <h3 className="font-heading text-[18px] font-bold text-foreground-950">{title}</h3>
          <p className="mt-0.5 text-[15px] text-foreground-600">{meta}</p>
        </div>
        {action}
      </div>
      <div className="bg-background-100 p-4 md:p-6">{children}</div>
    </div>
  );
}