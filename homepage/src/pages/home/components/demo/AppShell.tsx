import { useState } from "react";
import type { ReactNode } from "react";
import { APP_MENU, DEMO_STORE } from "@/mocks/site";

interface AppShellProps {
  activeMenu: string;
  onNavigate?: (label: string) => void;
  children: ReactNode;
}

/**
 * 제품체험 공통 앱 껍데기(데스크톱 사이드바 + 모바일 메뉴).
 * 메뉴는 실제 button이고, 눌렀을 때만 onNavigate로 화면을 바꾼다(활성 표시는 activeMenu 기준).
 * 모바일에서는 상단 메뉴 버튼으로 같은 여섯 메뉴를 펼친다. 자동 전환은 없다.
 */
export default function AppShell({ activeMenu, onNavigate, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (label: string) => {
    setMobileOpen(false);
    onNavigate?.(label);
  };

  return (
    <div className="flex w-full min-w-0 bg-background-100">
      <aside className="hidden w-[212px] flex-none flex-col border-r border-background-200 bg-background-50 lg:flex">
        <div className="border-b border-background-200 p-4">
          <p className="font-heading text-[17px] font-bold text-foreground-950">척척사장</p>
          <div className="mt-3 flex w-full items-center justify-between rounded-md border border-background-200 bg-background-50 px-3 py-2.5 text-[15px] font-medium text-foreground-900">
            <span className="flex min-w-0 items-center gap-2">
              <i className="ri-store-2-line text-[18px] text-primary-700" />
              <span className="truncate">{DEMO_STORE}</span>
            </span>
            <i className="ri-arrow-down-s-line flex-none text-[18px] text-foreground-600" />
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-2.5" aria-label="척척사장 메뉴 (예시)">
          {APP_MENU.map((item) => {
            const isActive = item.label === activeMenu;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => go(item.label)}
                aria-current={isActive ? "page" : undefined}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-[15px] font-medium transition-colors ${
                  isActive
                    ? "bg-primary-50 text-primary-800"
                    : "text-foreground-700 hover:bg-background-100 hover:text-foreground-950"
                }`}
              >
                <i
                  className={`${item.icon} text-[18px] ${
                    isActive ? "text-primary-700" : "text-foreground-500"
                  }`}
                />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 모바일: 가게 이름 + 여섯 메뉴를 펼치는 버튼 */}
        <div className="relative border-b border-background-200 bg-background-50 lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="flex min-w-0 items-center gap-2 text-[16px] font-semibold text-foreground-950">
              <i className="ri-store-2-line text-[18px] text-primary-700" />
              <span className="truncate">{DEMO_STORE}</span>
            </span>
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-expanded={mobileOpen}
              className="flex min-h-[40px] flex-none items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 text-[14px] font-semibold text-foreground-800 transition-colors hover:border-primary-400"
            >
              <i className="ri-menu-line text-[16px]" />
              {activeMenu}
              <i
                className={
                  mobileOpen
                    ? "ri-arrow-up-s-line text-[16px]"
                    : "ri-arrow-down-s-line text-[16px]"
                }
              />
            </button>
          </div>
          {mobileOpen ? (
            <nav
              className="absolute inset-x-0 top-full z-20 border-b border-background-200 bg-background-50 p-2"
              aria-label="척척사장 메뉴 (예시)"
            >
              {APP_MENU.map((item) => {
                const isActive = item.label === activeMenu;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => go(item.label)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-[15px] font-medium transition-colors ${
                      isActive
                        ? "bg-primary-50 text-primary-800"
                        : "text-foreground-700 hover:bg-background-100"
                    }`}
                  >
                    <i
                      className={`${item.icon} text-[18px] ${
                        isActive ? "text-primary-700" : "text-foreground-500"
                      }`}
                    />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}