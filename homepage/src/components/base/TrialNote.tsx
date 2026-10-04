import { TRIAL_NOTE } from "@/mocks/site";

interface TrialNoteProps {
  className?: string;
  tone?: "light" | "dark";
}

export default function TrialNote({ className = "", tone = "light" }: TrialNoteProps) {
  const dot = tone === "dark" ? "bg-accent-400" : "bg-primary-500";
  const text = tone === "dark" ? "text-background-100" : "text-foreground-700";
  return (
    <p className={`flex items-start gap-2.5 text-[16px] leading-relaxed ${text} ${className}`}>
      <span aria-hidden="true" className={`mt-[9px] h-2 w-2 flex-none rounded-full ${dot}`} />
      {TRIAL_NOTE}
    </p>
  );
}