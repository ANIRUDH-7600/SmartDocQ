import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to top of page only for specific routes
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const scrollRoutes = ["/privacy", "/terms", "/help"];
    if (scrollRoutes.includes(pathname)) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [pathname]);

  return null;
}
