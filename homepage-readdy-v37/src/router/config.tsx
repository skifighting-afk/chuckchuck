import type { RouteObject } from "react-router-dom";
import SiteLayout from "@/components/feature/SiteLayout";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/home/page";
import Product from "@/pages/product/page";
import TryPage from "@/pages/try/page";
import StartPage from "@/pages/start/page";
import Pricing from "@/pages/pricing/page";
import Guide from "@/pages/guide/page";
import Security from "@/pages/security/page";
import Terms from "@/pages/terms/page";
import Privacy from "@/pages/privacy/page";
import Contact from "@/pages/contact/page";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <SiteLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "product", element: <Product /> },
      { path: "try", element: <TryPage /> },
      { path: "start", element: <StartPage /> },
      { path: "pricing", element: <Pricing /> },
      { path: "guide", element: <Guide /> },
      { path: "security", element: <Security /> },
      { path: "terms", element: <Terms /> },
      { path: "privacy", element: <Privacy /> },
      { path: "contact", element: <Contact /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

export default routes;