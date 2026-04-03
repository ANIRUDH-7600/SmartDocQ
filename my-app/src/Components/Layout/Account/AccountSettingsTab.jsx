import React from "react";
import "./AccountSettings.css";

function AccountSettingsTab({
  onClearHistory,
  onLogoutAll,
  onDeleteClick,
  isClearingHistory = false,
}) {
  return (
    <div className="settings-content">
      <div className="settings-options">
        <section className="settings-card warning">
          <h3>Clear Chat History</h3>
          <p>
            Delete all your saved conversations across all documents. This action cannot be undone.
          </p>
          <button
            type="button"
            className="settings-btn danger"
            onClick={onClearHistory}
            disabled={isClearingHistory}
            aria-label="Clear all chat history across documents"
          >
            {isClearingHistory ? "Clearing..." : "Clear History"}
          </button>
        </section>

        <section className="settings-card">
          <h3>Logout from All Devices</h3>
          <p>Secure your account by signing out everywhere you’re logged in.</p>
          <button
            type="button"
            className="settings-btn"
            onClick={onLogoutAll}
            aria-label="Log out from all devices"
          >
            Logout All
          </button>
        </section>

        <section className="settings-card danger-zone" role="alert">
          <h3>Delete Account</h3>
          <p>Once you delete your account, all your data will be permanently removed.</p>
          <button
            type="button"
            className="settings-btn danger"
            onClick={onDeleteClick}
            aria-label="Delete account permanently"
          >
            Delete Account
          </button>
        </section>
      </div>
    </div>
  );
}

export default AccountSettingsTab;