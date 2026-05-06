import "./BodySection.css";
import HowItWorksSection from "./HowItWorksSection";

/* ============================================================================
 * PROCESS CARDS DATA
 * Static array defined outside component to prevent recreation on each render.
 * ============================================================================ */
const PROCESS_CARDS = [
  {
    id: 1,
    title: "Drop Your Docs",
    description: "Upload PDFs, Word docs, plain text, or URLs. SmartDocQ reads the content and prepares it for indexing—no manual conversions needed.",
    icon: "1",
    gradient: "linear-gradient(45deg, #00FF88, #00BFFF)",
    iconBg: "#25c7bf"
  },
  {
    id: 2,
    title: "AI Breaks It Down",
    description: "Your content is split into manageable chunks and converted to semantic embeddings so the system understands context, not just keywords.",
    icon: "2",
    gradient: "linear-gradient(45deg, #0066FF, #9933FF)",
    iconBg: "#2469d1"
  },
  {
    id: 3,
    title: "Index documents into a searchable vector database",
    description: "Those embeddings are stored in a vector database, making your documents semantically searchable across large collections.",
    icon: "3",
    gradient: "linear-gradient(45deg, #FFD700, #FF8C00)",
    iconBg: "#d66920"
  },
  {
    id: 4,
    title: "Smart Retrieval",
    description: "Ask questions in plain English. SmartDocQ retrieves the most relevant chunks from the vector database using semantic similarity instead of simple keyword matching.",
    icon: "4",
    gradient: "linear-gradient(45deg, #9933FF, #FF69B4)",
    iconBg: "#9933FF"
  },
  {
    id: 5,
    title: "Gemini-Powered Answers",
    description: "Retrieved chunks are passed to Google Gemini, which generates clear natural-language answers using only the provided document context.",
    icon: "5",
    gradient: "linear-gradient(45deg, #FF4500, #9400D3)",
    iconBg: "#bc2d58"
  },
  {
    id: 6,
    title: "Get answers grounded in your documents",
    description: "See answers together with supporting passages, so responses stay grounded in your own documents.",
    icon: "6",
    gradient: "linear-gradient(45deg, #7CFC00, #FF1493)",
    iconBg: "#be9b3c"
  }
];

/* ============================================================================
 * BODY SECTION COMPONENT
 * Renders the "How SmartDocQ Works" process cards and delegates
 * the video demo + steps guide to <HowItWorksSection />.
 * ============================================================================ */
function BodySection() {
  return (
    <>
      <section className="body-section" aria-labelledby="process-heading">
        <h2 id="process-heading" className="sr-only">How SmartDocQ Works</h2>
        <div className="cards-grid" role="list" aria-label="SmartDocQ processing pipeline">
          {PROCESS_CARDS.map((card) => (
            <article
              key={card.id}
              className="dark-card"
              style={{ '--card-gradient': card.gradient, '--icon-bg': card.iconBg }}
              role="listitem"
            >
              <div className="card-border" aria-hidden="true" />
              <div className="card-content">
                <div className="card-icon" style={{ backgroundColor: card.iconBg }} aria-hidden="true">
                  {card.icon}
                </div>
                <h3 className="card-title">{card.title}</h3>
                <p className="card-description">{card.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <HowItWorksSection />
    </>
  );
}

export default BodySection;
