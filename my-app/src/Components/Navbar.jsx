import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import "./navbar.css";
import logo from "./logo.png";
import { useToast } from "./ToastContext";
import { apiFetch } from "../config";
import Login from "./Login";
import Contact from "./Contact";
import Account from "./Account";
import lg from "./lg.png";
import lg1 from "./lg1.png";

const safeParseUser = (jsonString) => {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed && typeof parsed === "object" && typeof parsed.name === "string" && typeof parsed.email === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366f1'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

function Navbar() {
  const [popup, setPopup] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const profileRef = useRef();
  const { showToast } = useToast();

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const parsed = safeParseUser(savedUser);
      if (parsed) {
        setUser(parsed);
      } else {
        localStorage.removeItem("user");
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const shouldLock = !!popup || isMobileMenuOpen;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        if (popup) setPopup(null);
        else if (isMobileMenuOpen) setIsMobileMenuOpen(false);
        else if (showProfileMenu) setShowProfileMenu(false);
      }
    };

    document.body.style.overflow = shouldLock ? "hidden" : "";

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [popup, isMobileMenuOpen, showProfileMenu]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "user") setUser(e.newValue ? safeParseUser(e.newValue) : null);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);

    let timeoutId;
    const onResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (window.innerWidth > 768) setIsMobileMenuOpen(false);
      }, 100);
    };

    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", onResize);
    };
  }, [location.pathname]);

  const scrollToFeatures = useCallback(() => {
    setIsMobileMenuOpen(false);
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        document.getElementById("feat")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      document.getElementById("feat")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [location.pathname, navigate]);

  const handleLogout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Continue with local logout
    }
    setUser(null);
    setShowProfileMenu(false);
    localStorage.removeItem("user");
    showToast("Logout successful", { type: "success" });
    navigate("/");
  }, [navigate, showToast]);

  const handleAuthSuccess = useCallback((userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    setPopup(null);
  }, []);

  const handleContactClick = useCallback(() => {
    if (!user) {
      showToast("Please log in to use Contact Us", { type: "error" });
      return;
    }
    setPopup("contact");
    setIsMobileMenuOpen(false);
  }, [user, showToast]);

  const toggleProfileMenu = useCallback(() => {
    setShowProfileMenu((prev) => !prev);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((v) => !v);
  }, []);

  const closePopup = useCallback(() => setPopup(null), []);

  const openLogin = useCallback(() => {
    setPopup("login");
    setIsMobileMenuOpen(false);
  }, []);

  const openProfile = useCallback(() => {
    setPopup("account");
    setShowProfileMenu(false);
  }, []);

  const handleAvatarError = useCallback((e) => {
    e.target.src = DEFAULT_AVATAR;
  }, []);

  const isUploadPage = location.pathname === "/upload";

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <nav
        className={`navbar ${isUploadPage ? "upload-navbar" : ""} ${isMobileMenuOpen ? "mobile-open" : ""}`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="a">
          <Link to="/">
            <img className="logo" src={logo} alt="SmartDocQ Home" />
          </Link>
        </div>

        <button
          type="button"
          className={`menu-toggle ${isMobileMenuOpen ? "open" : ""}`}
          aria-label="Toggle navigation menu"
          aria-controls="nav-links"
          aria-expanded={isMobileMenuOpen}
          onClick={toggleMobileMenu}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div id="nav-links" className="mid" role="menubar">
          <Link to="/" role="menuitem" onClick={() => setIsMobileMenuOpen(false)}>
            Home
          </Link>
          <button
            type="button"
            className="nav-link-btn"
            role="menuitem"
            onClick={scrollToFeatures}
          >
            Features
          </button>
          <button
            type="button"
            className="nav-link-btn"
            role="menuitem"
            onClick={handleContactClick}
          >
            Contact Us
          </button>
        </div>

        <div className="login">
          {!loading && (
            user ? (
              <div className="profile-section" ref={profileRef}>
                <button
                  type="button"
                  className="avatar-btn"
                  onClick={toggleProfileMenu}
                  aria-haspopup="true"
                  aria-expanded={showProfileMenu}
                  aria-label="User menu"
                >
                  <img
                    src={user.avatar || DEFAULT_AVATAR}
                    alt="Profile"
                    className="avatar"
                    onError={handleAvatarError}
                  />
                </button>
                {showProfileMenu && (
                  <div className="profile-dropdown" role="menu" aria-label="User menu">
                    <a className="dd" href="/" onClick={(e) => { e.preventDefault(); openProfile(); }}>
                      <img src={lg1} alt="" className="dpi" />Profile
                    </a>
                    <a className="dd" href="/" onClick={(e) => { e.preventDefault(); handleLogout(); }}>
                      <img src={lg} alt="" className="dpi" />Logout
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <button type="button" onClick={openLogin}>Login</button>
            )
          )}
        </div>
      </nav>

      {popup === "login" && (
        <div className="overlay" onClick={closePopup} role="dialog" aria-modal="true" aria-label="Login">
          <div className="popup" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="close-btn" onClick={closePopup} aria-label="Close">✕</button>
            <Login onAuthSuccess={handleAuthSuccess} />
          </div>
        </div>
      )}

      {popup === "contact" && (
        <div className="overlay" onClick={closePopup} role="dialog" aria-modal="true" aria-label="Contact">
          <div className="popup contact-popup" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="close-btn" onClick={closePopup} aria-label="Close">✕</button>
            <Contact
              onSuccess={closePopup}
              defaultName={user?.name}
              defaultEmail={user?.email}
            />
          </div>
        </div>
      )}

      {popup === "account" && (
        <Account
          user={user}
          onClose={closePopup}
          onUpdated={setUser}
        />
      )}
    </>
  );
}

export default Navbar;
