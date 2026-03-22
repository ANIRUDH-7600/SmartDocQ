import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ToastProvider } from './Components/ToastContext';
import Navbar from './Components/Layout/Navbar';
import Hero from './Components/HeroSection';
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
import "./App.css";

const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

function PageLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
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
      <Route path="/login"       element={<PageLayout><Login /></PageLayout>} />
      <Route path="/help"        element={<PageLayout><HelpCenter /></PageLayout>} />
      <Route path="/privacy"     element={<PageLayout><PrivacyPolicy /></PageLayout>} />
      <Route path="/terms"       element={<PageLayout><TermsOfService /></PageLayout>} />
      <Route path="/share/:shareId" element={<PageLayout><ShareChat /></PageLayout>} />
      <Route path="/upload"      element={<RequireAuth><PageLayout><Upload /></PageLayout></RequireAuth>} />
      <Route path="/admin"       element={<AdminRoute />} />
    </Routes>
  );
}

function App() {
  const [revealStarted, setRevealStarted] = useState(false);

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <ToastProvider>
          <LandingPage onRevealStart={() => setRevealStarted(true)} />
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