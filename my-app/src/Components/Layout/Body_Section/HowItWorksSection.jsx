import { useRef, useState, useEffect } from 'react';
import Lottie from "lottie-react";
import video from "./assets/Guide.mp4";
import arrow from "./assets/Arrow.json";
import thumb from "./assets/ThumbNail.png";

/* ============================================================================
 * CONSTANTS
 * ============================================================================ */
const STEPS = [
  { id: 1, title: "Upload Your Documents", description: "Drag and drop PDFs, DOCX, or TXT files into SmartDocQ." },
  { id: 2, title: "Ask in Natural Language", description: "Ask questions in natural, conversational language—no special syntax needed." },
  { id: 3, title: "See Document-Grounded Answers", description: "SmartDocQ returns answers grounded in your documents, alongside the supporting text." }
];

/* ============================================================================
 * VIDEO SECTION COMPONENT
 * Lazy-loaded video that only plays when in viewport.
 * ============================================================================ */
const VideoSection = () => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const videoEl = videoRef.current;
    if (!container || !videoEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          videoEl.play().catch(() => {});
        } else {
          videoEl.pause();
          setIsInView(false);
          try {
            // Reset so we show the thumbnail (not the last frame) offscreen.
            videoEl.currentTime = 0;
          } catch {
            // Some browsers can throw if seeking isn't allowed yet.
          }
        }
      },
      // Start the swap slightly BEFORE the section is in view so the user
      // doesn't see the thumbnail-to-video transition.
      { threshold: 0.01, rootMargin: "0px 0px 120px 0px" }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="video-section" ref={containerRef}>
      <div className="video-wrapper">
        <img
          src={thumb}
          className={`video-thumb ${isInView ? "hidden" : ""}`}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
        <video
          ref={videoRef}
          className={`demo-video ${isInView ? "visible" : ""}`}
          loop
          playsInline
          muted
          draggable="false"
          disablePictureInPicture
          poster={thumb}
          preload="metadata"
          aria-label="SmartDocQ demo showing document upload and AI-powered question answering"
        >
          <source src={video} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
};

/* ============================================================================
 * STEPS SECTION COMPONENT
 * How-to-use guide with viewport-triggered Lottie arrows.
 * ============================================================================ */
const StepsSection = () => {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(section);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="steps-section" ref={sectionRef} role="list" aria-label="Getting started steps">
      {STEPS.map((step, index) => (
        <div key={step.id} style={{ display: 'contents' }}>
          <article className="step" role="listitem">
            <h3><span>Step {step.id}:</span> {step.title}</h3>
            <p>{step.description}</p>
          </article>
          {index < STEPS.length - 1 && (
            <div className="arrow-wrapper" aria-hidden="true">
              {isVisible && <Lottie animationData={arrow} loop className="arrow" />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

/* ============================================================================
 * HOW IT WORKS SECTION COMPONENT
 * Combines the demo video and 3-step usage guide.
 * ============================================================================ */
function HowItWorksSection() {
  return (
    <>
      <h2 id="howto-heading" className="work-title">From Document to Answer in 3 Steps</h2>

      <section className="how-to-use" aria-labelledby="howto-heading">
        <div className="howto-container">
          <VideoSection />
          <StepsSection />
        </div>
      </section>
    </>
  );
}

export default HowItWorksSection;
