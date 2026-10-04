import { useState } from "react";
import ScreenFrame from "./ScreenFrame";
import { DEMO_CONTRACTS } from "@/mocks/site";

const ROWS = [
  { key: "period", label: "계약 기간" },
  { key: "hours", label: "근무 시간" },
  { key: "hourlyWage", label: "시급" },
  { key: "payDay", label: "임금 지급일" },
  { key: "workplace", label: "근무 장소" },
  { key: "duties", label: "업무 내용" },
  { key: "leave", label: "휴일·휴가" },
] as const;

/** 실제 앱에서 제공하는 근로계약 관련 기능(과장 없이 사실만) */
const REAL_FEATURES = ["사장님 근로조건 작성·서명", "직원 본문 확인 후 서명", "본문·양측 기록 보관·사본 다운로드"];

/**
 * 근로계약서 화면 (제품체험 메뉴 중 하나).
 * 왼쪽 목록에서 가상 직원을 고르면 오른쪽에 그 직원의 근로조건이 바로 바뀐다.
 * "검토용 사본 내려받기"는 지금 화면의 조건을 그대로 담은 .txt 파일을 만들어 저장한다.
 * 실제 개인정보를 받지 않고 실제 서명도 하지 않는다 — 모든 값은 화면 체험용 가상 데이터다.
 */
export default function ContractScreen() {
  const [selectedId, setSelectedId] = useState(DEMO_CONTRACTS[0].id);
  const [downloaded, setDownloaded] = useState(false);
  const selected =
    DEMO_CONTRACTS.find((item) => item.id === selectedId) ?? DEMO_CONTRACTS[0];

  const selectEmployee = (id: string) => {
    setSelectedId(id);
    setDownloaded(false);
  };

  const downloadReview = () => {
    const lines = [
      "근로계약서 (검토용 사본)",
      "",
      "※ 이 파일은 화면 체험용 가상 데이터예요. 실제 근로계약이 아니며 입력한 내용은 저장되지 않아요.",
      "",
      "가게: 우리 가게 (예시)",
      `성명: ${selected.name} (가상)`,
      `직무: ${selected.role}`,
      `계약 기간: ${selected.period}`,
      `근무 시간: ${selected.hours}`,
      `시급: ${selected.hourlyWage}`,
      `임금 지급일: ${selected.payDay}`,
      `근무 장소: ${selected.workplace}`,
      `업무 내용: ${selected.duties}`,
      `휴일·휴가: ${selected.leave}`,
      "",
      "서명: ____________",
      "(가상 체험용이라 실제 서명은 하지 않아요. 앱에서 양측 확인·서명과 사본을 관리해요. 이메일 인증·발송은 연결 준비 중이에요.)",
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `근로계약서_검토용_${selected.name}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  return (
    <ScreenFrame title="근로계약서" meta={`가상 직원 ${DEMO_CONTRACTS.length}명 · 9월 23일 기준 (예시)`}>
      <div className="grid gap-4 md:grid-cols-[236px_1fr] md:items-start">
        {/* 가상 직원 선택 */}
        <div className="min-w-0">
          <p className="mb-2 text-[15px] font-semibold text-foreground-800">직원 선택</p>
          <ul className="space-y-2">
            {DEMO_CONTRACTS.map((person) => {
              const isActive = person.id === selectedId;
              return (
                <li key={person.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => selectEmployee(person.id)}
                    aria-pressed={isActive}
                    className={`flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors ${
                      isActive
                        ? "border-primary-400 bg-primary-50"
                        : "border-background-200 bg-background-50 hover:border-primary-300"
                    }`}
                  >
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-secondary-100 text-[16px] font-semibold text-secondary-900">
                      {person.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold text-foreground-950">
                        {person.name}
                      </span>
                      <span className="block truncate text-[14px] text-foreground-600">
                        {person.role}
                      </span>
                    </span>
                    <i
                      className={`flex-none text-[18px] ${
                        isActive ? "ri-checkbox-circle-line text-primary-700" : "ri-arrow-right-s-line text-foreground-400"
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 계약 내용 확인 */}
        <div className="min-w-0 rounded-md border border-background-200 bg-background-50 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-heading text-[20px] font-bold text-foreground-950">
                {selected.name}
              </p>
              <p className="mt-0.5 text-[15px] text-foreground-600">{selected.role}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="whitespace-nowrap rounded-full bg-secondary-100 px-3 py-1 text-[14px] font-semibold text-secondary-900">
                가상 데이터 체험
              </span>
              <span className="whitespace-nowrap rounded-full bg-primary-100 px-3 py-1 text-[14px] font-semibold text-primary-800">
                유료 기능 예시 · 사장님5부터
              </span>
            </div>
          </div>

          <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {ROWS.map((row) => (
              <div
                key={row.key}
                className={row.key === "duties" || row.key === "leave" ? "min-w-0 sm:col-span-2" : "min-w-0"}
              >
                <dt className="text-[14px] text-foreground-600">{row.label}</dt>
                <dd className="mt-0.5 text-[16px] font-medium text-foreground-900">
                  {selected[row.key]}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-background-200 pt-4">
            <button
              type="button"
              onClick={downloadReview}
              className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-600 px-5 text-[16px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
            >
              <i className="ri-download-2-line text-[18px]" />
              검토용 사본 내려받기 (.txt)
            </button>
            {downloaded ? (
              <span className="flex items-center gap-1.5 text-[15px] font-semibold text-primary-800">
                <i className="ri-checkbox-circle-line text-[17px]" />
                검토용 사본을 내려받았어요
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* 실제 제공 기능 + 이메일 연결 준비 안내 (작게) */}
      <div className="mt-4 rounded-md border border-background-200 bg-background-50 p-4">
        <p className="text-[15px] font-semibold text-foreground-800">앱에서 제공하는 계약 관련 기능</p>
        <p className="mt-1 text-[14px] leading-relaxed text-foreground-600">
          근로계약서는 사장님5(월 19,900원) 이상 유료 요금제에서 제공돼요.
        </p>
        <ul className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2">
          {REAL_FEATURES.map((item) => (
            <li key={item} className="flex items-center gap-2 text-[15px] text-foreground-800">
              <i className="ri-check-line text-[17px] text-primary-600" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-start gap-2 text-[14px] leading-relaxed text-foreground-600">
          <i className="ri-information-line mt-0.5 text-[16px] text-foreground-500" />
          앱에서 양측 확인·서명과 사본을 관리해요. 이메일 인증·발송은 연결 준비 중이에요.
        </p>
      </div>
    </ScreenFrame>
  );
}