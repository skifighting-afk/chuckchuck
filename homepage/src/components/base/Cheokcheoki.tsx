import { CHARACTER } from "@/mocks/site";

type CheokcheokiProps = {
  className?: string;
};

/**
 * 공식 캐릭터 "척척이" 이미지를 그대로 사용하는 공용 컴포넌트.
 * 크기는 항상 부모 컨테이너에서 명시하고, 이 컴포넌트는 object-contain 으로 비율을 지킨다.
 * hover 시 3도만 기울고, 무한 애니메이션은 없다.
 */
export default function Cheokcheoki({ className = "" }: CheokcheokiProps) {
  return (
    <img
      src={CHARACTER.image}
      alt={CHARACTER.alt}
      width={320}
      height={320}
      decoding="async"
      className={`char-tilt h-full w-full object-contain ${className}`}
    />
  );
}