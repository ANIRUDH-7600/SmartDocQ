import React from "react";
import Lottie from "lottie-react";
import { useNavigate } from "react-router-dom";
import errorAnimation from "./assets/404-Error.json";
import { safeParseUser } from "../Layout/Navbar/useAuth";
import "./RequireAuth.css";

const RequireAuth = ({ children }) => {
  const navigate = useNavigate();
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
              className="auth-lottie"
            />
          </div>
          <h2 className="auth-title">Access Restricted</h2>
          <p className="auth-desc">
            You must be logged in to view this content. Please sign in to continue.
          </p>
          <button className="auth-login-btn" onClick={() => navigate("/")}>
            Log In
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default RequireAuth;