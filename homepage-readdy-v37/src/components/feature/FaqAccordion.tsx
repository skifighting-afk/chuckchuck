import { useState } from "react";

export interface FaqItem {
  q: string;
  a: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

export default function FaqAccordion({ items }: FaqAccordionProps) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="border-y border-background-200">
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={item.q} className="border-b border-background-200 last:border-b-0">
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : index)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-6 py-5 text-left"
              >
                <span className="text-[17px] font-medium leading-relaxed text-foreground-950 md:text-[18px]">
                  {item.q}
                </span>
                <i
                  className={`flex-none text-2xl transition-transform duration-300 ${
                    isOpen ? "ri-subtract-line text-primary-600" : "ri-add-line text-foreground-600"
                  }`}
                />
              </button>
            </h3>
            {isOpen ? (
              <p className="pb-6 pr-4 text-[16px] leading-relaxed text-foreground-700 md:pr-12 md:text-[17px]">
                {item.a}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}