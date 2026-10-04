export default function Anno({ n }: { n: number }) {
  return (
    <span
      className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent-400 text-[14px] font-bold text-foreground-950"
      aria-hidden="true"
    >
      {n}
    </span>
  );
}