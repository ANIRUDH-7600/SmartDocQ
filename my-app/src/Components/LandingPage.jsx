import { useEffect } from "react";
import { gsap } from "gsap";
import "./LandingPage.css";

export default function LandingPage({ onRevealStart }) {
  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Skip animation for accessibility
    if (prefersReduced) {
      const loader = document.getElementById("loader");

      if (loader) {
        loader.style.display = "none";
      }

      if (onRevealStart) {
        onRevealStart();
      }

      return;
    }

    const loader = document.getElementById("loader");
    const lineTop = document.getElementById("loader-line-top");
    const lineBottom = document.getElementById("loader-line-bottom");
    const wordmark = document.getElementById("loader-wordmark");
    const ambient = document.getElementById("ambient-light");

    const tl = gsap.timeline();

    // Ambient reveal — subtle scale for depth (no blur)
    tl.to(
      ambient,
      {
        opacity: 1,
        duration: 1.1,
        ease: "power2.out",
        scale: 1.03,
      },
      0
    );

    // Vertical lines
    tl.to(
      [lineTop, lineBottom],
      {
        height: 72,
        opacity: 1,
        duration: 0.9,
        ease: "power3.inOut",
      },
      0.15
    );

    // Wordmark reveal — tighter typography, subtle lift
    tl.to(
      wordmark,
      {
        opacity: 1,
        clipPath: "inset(0 0% 0 0)",
        duration: 1,
        ease: "power3.out",
        y: 0,
        autoAlpha: 1,
      },
      "-=0.45"
    );

    // Hold briefly and then perform a refined exit (no harsh scale)
    tl.to({}, { duration: 0.55 });

    // Wordmark exit — subtle move and fade
    tl.to(
      wordmark,
      {
        opacity: 0,
        y: -6,
        duration: 0.55,
        ease: "power2.inOut",
      },
      0
    );

    // Lines collapse
    tl.to(
      [lineTop, lineBottom],
      {
        opacity: 0,
        height: 0,
        duration: 0.6,
        ease: "power2.inOut",
      },
      "-=0.45"
    );

    // Ambient fade — return to neutral
    tl.to(
      ambient,
      {
        opacity: 0,
        duration: 0.8,
        ease: "power2.inOut",
        scale: 1.0,
      },
      "-=0.6"
    );

    // Final loader fade — gentle fade only
    tl.to(
      loader,
      {
        opacity: 0,
        duration: 0.65,
        ease: "power2.inOut",
        onComplete: () => {
          loader.style.display = "none";

          if (onRevealStart) {
            onRevealStart();
          }
        },
      },
      "-=0.35"
    );

    return () => {
      gsap.killTweensOf([
        loader,
        lineTop,
        lineBottom,
        wordmark,
        ambient,
      ]);
    };
  }, [onRevealStart]);

  return (
    <>
      {/* Noise texture */}
      <div
        className="noise-overlay"
        aria-hidden="true"
      />

      {/* Opening Loader */}
      <div
        id="loader"
        aria-label="Opening sequence"
      >
        {/* Ambient atmosphere */}
        <div id="ambient-light" />

        {/* Top line */}
        <div
          className="loader-line"
          id="loader-line-top"
        />

        {/* Logo */}
        <div
          className="loader-wordmark"
          id="loader-wordmark"
        >
          SmartDocQ
        </div>

        {/* Bottom line */}
        <div
          className="loader-line"
          id="loader-line-bottom"
        />
      </div>
    </>
  );
}