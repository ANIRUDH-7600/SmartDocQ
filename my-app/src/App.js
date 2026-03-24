import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ToastProvider } from './Components/ToastContext';
import Navbar from './Components/Layout/Navbar';
import Hero from './Components/Layout/Hero_Section/HeroSection';
import Body from './Components/BodySection';
import Top from './Components/Top';
import Footer from './Components/Footer';
import Upload from './Components/UploadPage';
import Login from './Components/Auth/Login';
import RequireAuth from './Components/Auth/RequireAuth';
import AdminRoute from './Components/Admin/AdminRoute';
import HelpCenter from './Components/HelpCenter';
import PrivacyPolicy from './Components/PrivacyPolicy';
import TermsOfService from './Components/TermsOfService';
import ShareChat from './Components/ShareChat';
import LandingPage from './Components/LandingPage';
import errorAnimation from './Animations/404-Page-Error.json';
import "./App.css";

const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

function PageLayout({ children }) {
  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-layout-content">
        {children}
      </main>
      <Footer />
    </div>
  );
}

function Main() {
  useEffect(() => {
    if (!sessionStorage.getItem('smartdocqAlert')) {
      sessionStorage.setItem('smartdocqAlert', 'shown');
      setTimeout(() => {
        window.alert(
          '⚠️ TEMPORARY SERVICE LIMITATION\n\n' +
          'Only the backend AI services of SmartDocQ are currently paused due to cloud infrastructure cost constraints.\n\n' +
          'Frontend Status: Fully Operational\n\n' +
          'You can still explore the platform\'s interface, features, and design.\n\n' +
          'For full system architecture, AI pipeline details, and complete implementation:\n' +
          'Please visit the GitHub repository linked in the footer.'
        );
      }, 600);
    }
  }, []);

  return (
    <Routes>
      <Route path="/"            element={<PageLayout><Hero /><Body /><Top /></PageLayout>} />
      <Route path="/help"        element={<PageLayout><HelpCenter /></PageLayout>} />
      <Route path="/privacy"     element={<PageLayout><PrivacyPolicy /></PageLayout>} />
      <Route path="/terms"       element={<PageLayout><TermsOfService /></PageLayout>} />
      <Route path="/share/:shareId" element={<PageLayout><ShareChat /></PageLayout>} />
      <Route path="/upload"      element={<RequireAuth><PageLayout><Upload /></PageLayout></RequireAuth>} />
      <Route path="/admin"       element={<AdminRoute />} />
      <Route
        path="*"
        element={(
          <PageLayout>
            <div
              style={{
                minHeight: "60vh",
                padding: "40px 16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              <Lottie
                animationData={errorAnimation}
                loop
                autoplay
                style={{ width: 220, maxWidth: '80%', marginBottom: 24 }}
              />
              <h1 style={{ fontSize: "2rem", marginBottom: "12px" }}>Page not found</h1>
              <p style={{ opacity: 0.7 }}>
                The page you&apos;re looking for doesn&apos;t exist or has moved.
              </p>
            </div>
          </PageLayout>
        )}
      />
    </Routes>
  );
}

function App() {
  const [revealStarted, setRevealStarted] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const handleUnauthorized = () => {
      setShowLogin(prev => prev || true);
    };

    window.addEventListener("unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener("unauthorized", handleUnauthorized);
    };
  }, []);

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <ToastProvider>
          <LandingPage onRevealStart={() => setRevealStarted(true)} />
          {showLogin && (
            <div className="overlay" onClick={() => setShowLogin(false)} role="presentation">
              <div
                className="popup login-popup"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="auth-popup-close"
                  onClick={() => setShowLogin(false)}
                  aria-label="Close authentication dialog"
                  type="button"
                >
                  ✕
                </button>
                <Login onClose={() => setShowLogin(false)} />
              </div>
            </div>
          )}
          <div style={{
            opacity: revealStarted ? 1 : 0,
            transition: 'opacity 0.2s ease',
            position: 'relative',
            zIndex: 1,
            pointerEvents: revealStarted ? 'auto' : 'none',
          }}>
            <Main />
          </div>
        </ToastProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;