import React, { useState, useEffect, useMemo } from "react";
import "./Top.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

export default function Top() {
  const [visible, setVisible] = useState(false);
  const scrollElement = useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.scrollingElement || document.documentElement;
  }, []);

  useEffect(() => {
    if (!scrollElement) return undefined;
    const toggleVisibility = () => {
      setVisible(scrollElement.scrollTop > 200);
    };
    // Passive listener improves scroll performance by guaranteeing no preventDefault().
    window.addEventListener("scroll", toggleVisibility, { passive: true });
    return () => {
      window.removeEventListener("scroll", toggleVisibility);
    };
  }, [scrollElement]);

  const scrollToTop = () => {
    if (typeof window === "undefined") return;
    if (!scrollElement) return;
    const navbar = document.getElementById("navbar");
    const targetY = navbar
      ? navbar.getBoundingClientRect().top + window.pageYOffset
      : 0;
    const triggers = ScrollTrigger?.getAll ? ScrollTrigger.getAll() : [];
    const resumeTriggers = () => {
      triggers.forEach((trigger) => trigger.enable());
      ScrollTrigger?.refresh?.();
    };
    const pauseTriggers = () => {
      triggers.forEach((trigger) => trigger.disable(true));
    };
    pauseTriggers();
    gsap.killTweensOf(window);
    gsap.to(window, {
      duration: 1.6,
      scrollTo: { y: targetY, autoKill: false },
      ease: "power2.inOut",
      overwrite: true,
      onComplete: () => {
        window.scrollTo({ top: targetY, left: 0 });
        resumeTriggers();
      },
    });
  };

  return (
    <button
      type="button"
      aria-label="Back to top"
      title="Back to Top"
      className={`scroll-to-top ${visible ? "show" : ""}`}
      onClick={scrollToTop}
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        aria-hidden="true"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
      <span className="tooltip">Back to Top</span>
    </button>
  );
}
