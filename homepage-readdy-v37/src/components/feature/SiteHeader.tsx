import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import Container from "@/components/base/Container";
import Logo from "@/components/base/Logo";
import { EXTERNAL, NAV_LINKS } from "@/mocks/site";

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b bg-background-50/95 backdrop-blur-md transition-colors ${
        scrolled ? "border-background-200" : "border-transparent"
      }`}
    >
      <Container>
        <div className="flex h-[68px] items-center justify-between gap-4 lg:h-[76px]">
          <div className="flex min-w-0 items-center gap-8">
            <Logo />
            <nav className="hidden items-center gap-1 md:flex" aria-label="주요 메뉴">
              {NAV_LINKS.map((link) =>
                link.external ? (
                  <a
                    key={link.to}
                    href={link.to}
                    className="whitespace-nowrap rounded-md px-3.5 py-2.5 text-[16px] font-medium text-foreground-800 transition-colors hover:bg-background-100 hover:text-foreground-950"
                  >
                    {link.label}
                  </a>
                ) : (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `whitespace-nowrap rounded-md px-3.5 py-2.5 text-[16px] font-medium transition-colors ${
                        isActive
                          ? "text-primary-700"
                          : "text-foreground-800 hover:bg-background-100 hover:text-foreground-950"
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                )
              )}
            </nav>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <a
              href={EXTERNAL.demo}
              className="flex min-h-[52px] items-center whitespace-nowrap rounded-md bg-primary-600 px-5 text-[16px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
            >
              무료로 시작하기
            </a>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            className="flex h-12 items-center gap-1.5 rounded-md px-3 text-[16px] font-medium text-foreground-900 transition-colors hover:bg-background-100 md:hidden"
          >
            <i className={open ? "ri-close-line text-2xl" : "ri-menu-line text-2xl"} />
            메뉴
          </button>
        </div>
      </Container>

      {open && (
        <div className="border-t border-background-200 bg-background-50 md:hidden">
          <Container>
            <nav className="flex flex-col py-2" aria-label="모바일 메뉴">
              {NAV_LINKS.map((link) =>
                link.external ? (
                  <a
                    key={link.to}
                    href={link.to}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-2 py-3.5 text-[17px] font-medium text-foreground-800 transition-colors"
                  >
                    {link.label}
                  </a>
                ) : (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `rounded-md px-2 py-3.5 text-[17px] font-medium transition-colors ${
                        isActive ? "text-primary-700" : "text-foreground-800"
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                )
              )}
              <div className="mt-1 flex flex-col gap-2 border-t border-background-200 py-4">
                <a
                  href={EXTERNAL.demo}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[56px] items-center justify-center whitespace-nowrap rounded-md bg-primary-600 px-4 text-[17px] font-semibold text-background-50"
                >
                  무료로 시작하기
                </a>
              </div>
            </nav>
          </Container>
        </div>
      )}
    </header>
  );
}