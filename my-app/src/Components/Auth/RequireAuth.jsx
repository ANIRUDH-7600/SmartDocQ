import React from "react";
import Lottie from "lottie-react";
import errorAnimation from "./assets/404-Error.json";
import { safeParseUser } from "../Layout/Navbar/useAuth";
import "./RequireAuth.css";

const RequireAuth = ({ children }) => {
  const user = safeParseUser(localStorage.getItem("user"));

  if (!user) {
    return (
      <div className="auth-gate-container">
        <div className="auth-gate-card">
          <div className="auth-visual">
            <Lottie
              animationData={errorAnimation}
              loop
              autoplay
              className="auth-lottie"/>
          </div>
          <h2 className="auth-title">Access Restricted</h2>
          <p className="auth-desc">
            You must be logged in to view this content. Please sign in to continue.
          </p>
          <button
            className="auth-login-btn"
            type="button"
            onClick={() => window.dispatchEvent(new Event("unauthorized"))}>
            Log In
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default RequireAuth;