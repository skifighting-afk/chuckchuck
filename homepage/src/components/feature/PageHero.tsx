import type { ReactNode } from "react";
import Container from "@/components/base/Container";
import Reveal from "@/components/base/Reveal";
import SectionLabel from "@/components/base/SectionLabel";

interface PageHeroProps {
  label: string;
  title: ReactNode;
  lead: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export default function PageHero({ label, title, lead, actions, children }: PageHeroProps) {
  return (
    <section className="border-b border-background-200 bg-background-50">
      <Container>
        <div className="grid gap-8 pb-12 pt-14 md:pb-16 md:pt-20 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <Reveal>
              <SectionLabel>{label}</SectionLabel>
            </Reveal>
            <Reveal delay={60}>
              <h1 className="mt-5 font-heading text-[34px] font-bold leading-[1.16] tracking-tight text-foreground-950 md:text-[48px]">
                {title}
              </h1>
            </Reveal>
          </div>
          <div className="lg:col-span-5">
            <Reveal delay={120}>
              <p className="max-w-lg text-[18px] leading-relaxed text-foreground-700">{lead}</p>
            </Reveal>
            {actions ? (
              <Reveal delay={160} className="mt-6">
                {actions}
              </Reveal>
            ) : null}
          </div>
        </div>
        {children}
      </Container>
    </section>
  );
}