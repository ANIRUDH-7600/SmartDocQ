import React from "react";
import { useAuthForm } from "./useAuthForm";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";
import "./Login.css";

export default function Login({ onAuthSuccess = () => {}, initialMode = "login", onClose = () => {} }) {
  const {
    isLogin, setIsLogin,
    loginData, signupData,
    errors, loading,
    passwordStrength,
    showPassword,
    handleChange,
    handleSubmit,
    handleGoogleSuccess,
    togglePasswordVisibility,
    getRef,
  } = useAuthForm({ onAuthSuccess, initialMode });

  return (
    <div className="auth-container">
      <div className="form-toggle">
        <button className={`toggle-btn ${isLogin ? "active" : ""}`} onClick={() => setIsLogin(true)}>Sign In</button>
        <button className={`toggle-btn ${!isLogin ? "active" : ""}`} onClick={() => setIsLogin(false)}>Sign Up</button>
        <div className={`toggle-slider ${isLogin ? "login" : "signup"}`} />
      </div>

      <div className={`form-wrapper ${isLogin ? "active" : ""}`}>
        <LoginForm
          loginData={loginData}
          errors={errors}
          loading={loading}
          showPassword={showPassword}
          getRef={getRef}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          togglePasswordVisibility={togglePasswordVisibility}
          handleGoogleSuccess={handleGoogleSuccess}
        />
      </div>

      <div className={`form-wrapper ${!isLogin ? "active" : ""}`}>
        <SignupForm
          signupData={signupData}
          errors={errors}
          loading={loading}
          showPassword={showPassword}
          passwordStrength={passwordStrength}
          getRef={getRef}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          togglePasswordVisibility={togglePasswordVisibility}
          handleGoogleSuccess={handleGoogleSuccess}
        />
      </div>
    </div>
  );
}