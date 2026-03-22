import React from "react";

const REQUIREMENTS = [
  { key: "length",    text: "8+ characters" },
  { key: "uppercase", text: "1 uppercase" },
  { key: "number",    text: "1 number" },
  { key: "special",   text: "1 special char" },
];

export default function PasswordStrength({ password, strength = {} }) {
  if (!password || !strength.label) return null;

  const { score = 0, label = "", requirements = {} } = strength;
  const strengthKey = label.toLowerCase();

  return (
    <div className="password-strength-container">
      <div className="strength-header">
        <span className="strength-label" data-strength={strengthKey}>{label}</span>
        <span className="strength-percentage">{score}%</span>
      </div>
      <div className="strength-bar-wrapper">
        <div
          className="strength-bar"
          data-strength={strengthKey}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="requirements-grid">
        {REQUIREMENTS.map(({ key, text }) => (
          <div key={key} className={`requirement ${requirements[key] ? "met" : ""}`}>
            <span className="check-icon">{requirements[key] ? "✓" : "○"}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}