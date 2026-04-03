import './Footer.css';
import { FaGithub, FaDiscord } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { useLocation, Link } from 'react-router-dom';
import ClickSpark from '../../Effects/ClickSpark';

/* ============================================================================
 * CONSTANTS
 * Static values defined outside component to prevent recreation on render.
 * ============================================================================ */
const CURRENT_YEAR = new Date().getFullYear();

const Footer = () => {
  const location = useLocation();
  const isUploadPage = location.pathname === "/upload";
  const isHelpPage = location.pathname === "/help";
  const isPrivacyPage = location.pathname === "/privacy";
  const isTermsPage = location.pathname === "/terms";
  const isSharePage = location.pathname.startsWith("/share/");

  return (
  <ClickSpark
    sparkColor="#fff"
    sparkSize={10}
    sparkRadius={15}
    sparkCount={8}
    duration={400}>
  <footer className={`footer ${isUploadPage ? 'upload-footer' : ''} ${(isHelpPage || isPrivacyPage || isTermsPage || isSharePage) ? 'footer--flush' : ''}`} role="contentinfo">
      <div className="footer-container">
        <div className="footer-main">
          <section className="footer-section company-info">
            <div className="footer-logo">
              <h3>SmartDocQ</h3>
            </div>
            <p className="company-description">
              Search, understand, and chat with your documents.
            </p>
            <nav className="social-links" aria-label="Social media links">
              <a href="https://github.com/SmartDocQ/SmartDocQ.git" className="social-link" aria-label="GitHub (opens in new tab)" target="_blank" rel="noreferrer noopener">
                <FaGithub aria-hidden="true" />
              </a>
              <a href="https://x.com/SmartDocQ" className="social-link" aria-label="X (opens in new tab)" target="_blank" rel="noreferrer noopener">
                <FaXTwitter aria-hidden="true" />
              </a>
              <a href="https://discord.gg/SwwWp9KvFF" className="social-link" aria-label="Discord (opens in new tab)" target="_blank" rel="noreferrer noopener">
                <FaDiscord aria-hidden="true" />
              </a>
            </nav>
          </section>

          <section className="footer-section support" aria-labelledby="support-heading">
            <h4 id="support-heading">Support</h4>
            <ul className="footer-links">
              <li><Link to="/help#top">Help Center</Link></li>
              <li><Link to="/help#faq">FAQ</Link></li>
            </ul>
          </section>
        </div>

        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <div className="copyright">
              <p>&copy; {CURRENT_YEAR} SmartDocQ. Built for fast, context-aware document search.</p>
            </div>
            <nav className="legal-links" aria-label="Legal">
              <Link to="/privacy#top">Privacy Policy</Link>
              <Link to="/terms#top">Terms of Service</Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
    </ClickSpark>
  );
};

export default Footer;
