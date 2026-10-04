import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SEO_META, SITE } from "@/mocks/site";

interface SeoProps {
  title?: string;
  description?: string;
  path?: string;
  keywords?: string;
}

// 앱·사전 체험처럼 검색 노출이 필요 없는 경로는 항상 noindex로 둔다.
const NOINDEX_ROUTES = ["/try", "/start"];

function normalizePath(path: string): string {
  const clean = (path || "/").split("?")[0].split("#")[0];
  if (!clean) return "/";
  const withSlash = clean.startsWith("/") ? clean : `/${clean}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
}

// 프리뷰 환경이면 실제 공개 도메인이 아니므로 canonical을 만들지 않는다.
function isPreviewEnv(): boolean {
  if (typeof __IS_PREVIEW__ !== "undefined" && __IS_PREVIEW__) return true;
  return typeof window !== "undefined" && window.location.pathname.startsWith("/preview");
}

export default function Seo({ title, description, path = "/", keywords }: SeoProps) {
  const location = useLocation();
  // 실제 렌더된 경로를 우선한다. (basename 제외된 경로)
  const route = normalizePath(location?.pathname || path);
  const meta = SEO_META[route];
  const known = Boolean(meta);

  const finalTitle = meta?.title || title || SITE.name;
  const finalDescription = meta?.description || description || "";
  const finalKeywords = meta?.keywords || keywords;

  const preview = isPreviewEnv();
  // 프리뷰, 앱 경로, 그리고 SEO_META에 없는 경로(404 등)는 색인하지 않는다.
  const noindex = preview || NOINDEX_ROUTES.includes(route) || !known;

  // canonical/og:url은 실제 서비스 중인 origin + 경로로만 만든다.
  // 프리뷰거나 매핑에 없는 경로면 canonical을 보류한다(임의 도메인 넣지 않음).
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const basePath = typeof __BASE_PATH__ === "string" ? __BASE_PATH__.replace(/\/+$/, "") : "";
  const urlPath = `${basePath}${route === "/" ? "/" : route}`;
  const absoluteUrl = known && !preview && origin.startsWith("http") ? `${origin}${urlPath}` : "";

  useEffect(() => {
    document.documentElement.lang = "ko";
  }, []);

  return (
    <>
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      {finalKeywords ? <meta name="keywords" content={finalKeywords} /> : null}
      {noindex ? <meta name="robots" content="noindex, follow" /> : null}
      {absoluteUrl ? <link rel="canonical" href={absoluteUrl} /> : null}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:locale" content={SITE.locale} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      {absoluteUrl ? <meta property="og:url" content={absoluteUrl} /> : null}
      <meta property="og:image" content={SITE.ogImage} />
      <meta property="og:image:alt" content={SITE.ogImageAlt} />

      <meta name="twitter:card" content={SITE.twitterCard} />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={SITE.ogImage} />
      <meta name="twitter:image:alt" content={SITE.ogImageAlt} />
    </>
  );
}