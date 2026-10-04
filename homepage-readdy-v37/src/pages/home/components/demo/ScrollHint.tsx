export default function ScrollHint() {
  return (
    <p className="mb-3 flex items-center gap-2 text-[15px] text-foreground-700 lg:hidden">
      <i className="ri-drag-move-2-line text-[18px] text-primary-700" />
      표가 넓어요. 옆으로 밀어서 보세요.
    </p>
  );
}