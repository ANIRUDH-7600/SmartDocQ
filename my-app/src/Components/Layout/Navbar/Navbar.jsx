import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Navbar.css";
import logo from "./assets/logo.png";
import icon from "./assets/icon1.png";
import { useToast } from "../../ToastContext";
import { useAuth } from "./useAuth";
import ProfileMenu from "./ProfileMenu";
import NavDialogs from "./NavDialogs";
import MobileSheet from "./MobileSheet";
import { useMobileMenu } from "./useMobileMenu";

const getActiveTab = (pathname) => {
  if (pathname === "/") return "Home";
  return null;
};

export default function Navbar() {
  const navigate   = useNavigate();
  const location   = useLocation();

  const [popup, setPopup]                     = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [activeTab, setActiveTab]             = useState(() => getActiveTab(location.pathname));
  const [sliderStyle, setSliderStyle]         = useState({ left: 0, width: 0, opacity: 0 });

  const navContainerRef  = useRef(null);
  const itemsRef         = useRef({});
  const pendingScrollRef = useRef(false);
  const profileRef       = useRef();

  const { showToast }                              = useToast();
  const { user, loading, persistUser, logout }     = useAuth();
  const { isMobileMenuOpen, close: closeMobileMenu, toggle: toggleMobileMenu } = useMobileMenu();

  const closePopup   = useCallback(() => setPopup(null), []);
  const isUploadPage = location.pathname === "/upload";

  // Keep activeTab in sync with the current URL
  useEffect(() => {
    const tab = getActiveTab(location.pathname);
    if (tab) setActiveTab(tab);
  }, [location.pathname]);

  // Handle Escape key for dialogs and profile menu (mobile menu ESC is handled inside useMobileMenu)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") { setPopup(null); setShowProfileMenu(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Lock page scroll while a popup is open
  useEffect(() => {
    const lock = !!popup;
    document.documentElement.style.overflow = lock ? "hidden" : "";
    document.body.style.overflow            = lock ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow            = "";
    };
  }, [popup]);

  // Update desktop navigation slider position
  const updateSlider = useCallback(() => {
    const activeEl    = itemsRef.current[activeTab];
    const containerEl = navContainerRef.current;
    if (activeEl && containerEl) {
      const navRect = containerEl.getBoundingClientRect();
      const elRect  = activeEl.getBoundingClientRect();
      setSliderStyle({ left: elRect.left - navRect.left, width: elRect.width, opacity: 1 });
    }
  }, [activeTab]);

  useEffect(() => {
    const raf = requestAnimationFrame(updateSlider);
    window.addEventListener("resize", updateSlider);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", updateSlider); };
  }, [updateSlider]);

  // Smoothly scroll the page to a target element
  const smoothScroll = (target, duration = 800) => {
    if (!target) return;
    const targetPos = target.getBoundingClientRect().top + window.pageYOffset;
    const startPos  = window.pageYOffset;
    const distance  = targetPos - startPos;
    let startTime   = null;
    const animate   = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const elapsed  = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress < 0.5
        ? 4 * progress ** 3
        : 1 - (-2 * progress + 2) ** 3 / 2;
      window.scrollTo(0, startPos + distance * ease);
      if (elapsed < duration) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  };

  const scrollToFeatures = useCallback(() => {
    const el = document.getElementById("feat");
    if (el) { smoothScroll(el, 800); }
    else    { pendingScrollRef.current = true; navigate("/"); }
  }, [navigate]);

  useEffect(() => {
    if (pendingScrollRef.current && location.pathname === "/") {
      pendingScrollRef.current = false;
      const el = document.getElementById("feat");
      if (el) setTimeout(() => smoothScroll(el), 100);
    }
  }, [location.pathname]);

  // Central handler for mobile sheet navigation items
  const handleSheetItemClick = useCallback((itemId) => {
    setActiveTab(itemId);
    closeMobileMenu();
    if (itemId === "Home") {
      navigate("/");
    } else if (itemId === "Features") {
      setTimeout(() => scrollToFeatures(), 300);
    } else if (itemId === "Contact") {
      setTimeout(() => {
        if (!user) { showToast("Please log in to use Contact Us", { type: "error" }); return; }
        setPopup("contact");
      }, 300);
    }
  }, [navigate, scrollToFeatures, user, showToast, closeMobileMenu]);

  return (
    <>
      <nav
          className={`navbar ${isUploadPage ? "upload-navbar" : ""}`}
          role="navigation"
          aria-label="Main navigation"
          id="navbar">

          {/* Logo section */}
          <div className="a">
            <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} aria-label="SmartDocQ Home">
              <img className="logo" src={logo} alt="SmartDocQ Logo" />
            </a>
          </div>

          {/* Desktop navigation (pill-style menu) */}
          <div
            id="nav-links"
            className="nav-links-container"
            role="menubar"
            aria-label="Main menu"
            ref={navContainerRef}>
            <div className="nav-slider" style={sliderStyle} />

            <div
              className={`nav-item ${activeTab === "Home" ? "active" : ""}`}
              onClick={() => { navigate("/"); setActiveTab("Home"); }}
              role="menuitem"
              ref={(el) => (itemsRef.current["Home"] = el)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 6.5L8 2l6 4.5V13a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z"/>
              </svg>
              Home
            </div>

            <div className="nav-divider" />

            <div
              className={`nav-item ${activeTab === "Features" ? "active" : ""}`}
              onClick={() => { setActiveTab("Features"); setTimeout(() => scrollToFeatures(), 300); }}
              role="menuitem"
              ref={(el) => (itemsRef.current["Features"] = el)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="5" height="5" rx="1"/>
                <rect x="9" y="2" width="5" height="5" rx="1"/>
                <rect x="2" y="9" width="5" height="5" rx="1"/>
                <rect x="9" y="9" width="5" height="5" rx="1"/>
              </svg>
              Features
            </div>

            <div className="nav-divider" />

            <div
              className={`nav-item ${activeTab === "Contact" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("Contact");
                setTimeout(() => {
                  if (!user) { showToast("Please log in to use Contact Us", { type: "error" }); return; }
                  setPopup("contact");
                }, 300);
              }}
              role="menuitem"
              ref={(el) => (itemsRef.current["Contact"] = el)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4h12M2 8h8M2 12h5"/>
                <circle cx="13" cy="11" r="2.5"/>
                <path d="M15 13.5l1.5 1.5"/>
              </svg>
              Contact Us
            </div>
          </div>

          {/* Authentication actions (login button or profile avatar) */}
          <div className="login">
            {!loading && (
              user ? (
                <div className="profile-section" ref={profileRef}>
                  <img
                    src={user.avatar || icon}
                    alt="Profile"
                    className="avatar"
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => setShowProfileMenu(true)}
                  />
                </div>
              ) : (
                <div
                  aria-label="User Login Button"
                  tabIndex={0}
                  role="button"
                  className="user-profile"
                  onClick={() => setPopup("login")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPopup("login");
                    }
                  }}
                >
                  <div className="user-profile-inner">
                    <svg
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                    >
                      <g data-name="Layer 2" id="Layer_2">
                        <path
                          d="m15.626 11.769a6 6 0 1 0 -7.252 0 9.008 9.008 0 0 0 -5.374 8.231 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 9.008 9.008 0 0 0 -5.374-8.231zm-7.626-4.769a4 4 0 1 1 4 4 4 4 0 0 1 -4-4zm10 14h-12a1 1 0 0 1 -1-1 7 7 0 0 1 14 0 1 1 0 0 1 -1 1z"
                        ></path>
                      </g>
                    </svg>
                    <p>Log In</p>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Mobile menu toggle button (hamburger) */}
          <button
            className={`menu-toggle ${isMobileMenuOpen ? "open" : ""}`}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-controls="mobile-sheet"
            aria-expanded={isMobileMenuOpen}
            onClick={toggleMobileMenu}
            type="button">
            <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
          </button>
        </nav>

      {/* Mobile navigation bottom sheet */}
      <MobileSheet
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
        activeTab={activeTab}
        onItemClick={handleSheetItemClick}
        user={user}
        onLogin={()   => { closeMobileMenu(); setPopup("login");    }}
        onSignUp={()  => { closeMobileMenu(); setPopup("signup");   }}
        onAccount={() => { closeMobileMenu(); setPopup("account");  }}
        onLogout={()  => { closeMobileMenu(); logout();             }}
      />

      {showProfileMenu && (
        <ProfileMenu
          triggerRef={profileRef}
          onProfile={() => { setPopup("account"); setShowProfileMenu(false); }}
          onLogout={() => { setShowProfileMenu(false); logout(); }}
          onClose={() => setShowProfileMenu(false)}
        />
      )}

      <NavDialogs
        popup={popup}
        user={user}
        onClose={closePopup}
        onAuthSuccess={(userData) => { persistUser(userData); setPopup(null); }}
        onUserUpdate={persistUser}
      />
    </>
  );
}