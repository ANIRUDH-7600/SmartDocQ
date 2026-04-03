import React, { useState, useRef, useEffect } from "react";
import "./Account.css";
import ppic from "./assets/p-pic.png";
import { useToast } from "../../ToastContext";
import AccountProfileTab from "./AccountProfileTab";
import AccountSettingsTab from "./AccountSettingsTab";
import {
  updateProfile,
  uploadAvatar,
  clearChatHistory,
  deleteAccount,
} from "../../../Services/AccountService";
import {
  compressImage,
  formatJoinedDate,
  formatLastLogin,
  formatName,
  isValidEmail,
  MAX_AVATAR_BYTES,
} from "./accountUtils";

function Account({ user, onClose, onUpdated }) {
  const { showToast } = useToast();

  const [avatarPreview, setAvatarPreview] = useState(user.avatar || ppic);
  const [avatarFile, setAvatarFile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState("account");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  const passwordRef = useRef();
  const confirmPasswordRef = useRef();

  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(avatarPreview);
        } catch (_) {}
      }
    };
  }, [avatarPreview]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size >= MAX_AVATAR_BYTES) {
      showToast("Image must be smaller than 1MB", { type: "error" });
      e.target.value = "";
      return;
    }

    try {
      const newUrl = URL.createObjectURL(file);

      setAvatarPreview((prev) => {
        if (prev && prev.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(prev);
          } catch (_) {}
        }
        return newUrl;
      });

      setAvatarFile(file);
    } catch (err) {
      showToast(err.message || "Failed to prepare avatar", { type: "error" });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "name") {
      setFormData((prev) => ({ ...prev, [name]: formatName(value) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const resetEditState = () => {
    setFormData({ name: user.name, email: user.email });
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setIsEditing(false);

    if (passwordRef.current) passwordRef.current.value = "";
    if (confirmPasswordRef.current) confirmPasswordRef.current.value = "";

    setAvatarPreview(user.avatar || ppic);
    setAvatarFile(null);
  };

  const handleSave = async () => {
    const newPassword = passwordRef.current?.value;
    const confirmPassword = confirmPasswordRef.current?.value;

    if (formData.name.length < 3) {
      showToast("Name must be at least 3 characters", { type: "error" });
      return;
    }

    if (!isValidEmail(formData.email)) {
      showToast("Invalid email format", { type: "error" });
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      showToast("Passwords do not match", { type: "error" });
      return;
    }

    const payload = {};
    if (formData.name && formData.name !== user.name) payload.name = formData.name;
    if (formData.email && formData.email !== user.email) payload.email = formData.email;
    if (newPassword) payload.password = newPassword;

    if (Object.keys(payload).length === 0 && !avatarFile) {
      showToast("No changes to save", { type: "info" });
      setIsEditing(false);
      return;
    }

    setIsSaving(true);

    try {
      let updatedUser = { ...user };

      const putTask =
        Object.keys(payload).length > 0 ? updateProfile(payload) : null;

      const avatarTask = avatarFile
        ? (async () => {
            let uploadFile = avatarFile;
            try {
              uploadFile = await compressImage(avatarFile, {
                maxSize: 512,
                quality: 0.82,
                mime: "image/jpeg",
              });
            } catch (_) {}
            return uploadAvatar(uploadFile);
          })()
        : null;

      const results = await Promise.all([putTask, avatarTask].filter(Boolean));
      results.forEach((r) => {
        if (r) updatedUser = { ...updatedUser, ...r };
      });

      localStorage.setItem("user", JSON.stringify(updatedUser));
      onUpdated && onUpdated(updatedUser);

      showToast("Profile updated successfully", { type: "success" });
      setIsEditing(false);

      if (passwordRef.current) passwordRef.current.value = "";
      if (confirmPasswordRef.current) confirmPasswordRef.current.value = "";
      setAvatarFile(null);

      setAvatarPreview((prev) => {
        if (prev && prev.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(prev);
          } catch (_) {}
        }
        return updatedUser.avatar || ppic;
      });
    } catch (err) {
      showToast(err.message || "Failed to update profile", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearHistory = async () => {
    setIsClearingHistory(true);
    try {
      await clearChatHistory();
      showToast("Chat history cleared!", { type: "success" });
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (err) {
      showToast(err.message || "Failed to clear chat history", { type: "error" });
    } finally {
      setIsClearingHistory(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      localStorage.removeItem("user");
      showToast("Account deleted permanently!", { type: "success" });

      setShowDeleteModal(false);
      onClose();
      window.location.reload();
    } catch (err) {
      showToast(err.message || "Failed to delete account", { type: "error" });
    }
  };

  const joinedDate = formatJoinedDate(user.createdAt);
  const lastLogin = formatLastLogin(user.lastLogin);

  return (
    <>
      <div className="account-overlay" onClick={onClose}>
        <div className="account-container" onClick={(e) => e.stopPropagation()}>
          <div className="sidebar-account-container">
            <div className="sidebar">
              <div className="sidebar-profile">
                <div className="avatar-wrapper">
                  <img
                    src={avatarPreview || user.avatar || ppic}
                    alt="User Avatar"
                    className="account-avatar"
                  />
                  {isEditing && (
                    <label className="avatar-edit-btn">
                      ✎
                      <input type="file" accept="image/*" onChange={handleAvatarChange} />
                    </label>
                  )}
                </div>
                <h2 className="account-name">{user.name}</h2>
              </div>

              <div className="sidebar-menu">
                <button
                  className={`menu-btn ${activeTab === "account" ? "active" : ""}`}
                  onClick={() => setActiveTab("account")}
                >
                  Account
                </button>
                <button
                  className={`menu-btn ${activeTab === "settings" ? "active" : ""}`}
                  onClick={() => setActiveTab("settings")}
                >
                  Settings
                </button>
              </div>
            </div>

            <div className="account-content">
              {activeTab === "account" ? (
                <AccountProfileTab
                  user={user}
                  isEditing={isEditing}
                  isSaving={isSaving}
                  formData={formData}
                  handleChange={handleChange}
                  handleSave={handleSave}
                  onCancel={resetEditState}
                  onEdit={() => {
                    setFormData({ name: user.name, email: user.email });
                    setIsEditing(true);
                  }}
                  onClose={onClose}
                  joinedDate={joinedDate}
                  lastLogin={lastLogin}
                  passwordRef={passwordRef}
                  confirmPasswordRef={confirmPasswordRef}
                  showNewPassword={showNewPassword}
                  setShowNewPassword={setShowNewPassword}
                  showConfirmPassword={showConfirmPassword}
                  setShowConfirmPassword={setShowConfirmPassword}
                />
              ) : (
                <AccountSettingsTab
                  onClearHistory={handleClearHistory}
                  onLogoutAll={() =>
                    showToast("Logged out from all devices!", { type: "info" })
                  }
                  onDeleteClick={() => {
                    showToast("⚠️ Careful! Deletion is permanent.", {
                      type: "warning",
                    });
                    setShowDeleteModal(true);
                  }}
                  isClearingHistory={isClearingHistory}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Account Deletion</h3>
            <p>
              Are you sure you want to permanently delete your account? <br />
              This action <strong>cannot</strong> be undone.
            </p>
            <div className="modal-actions">
              <button className="modal-btn danger" onClick={handleDeleteAccount}>
                Yes, Delete
              </button>
              <button
                className="modal-btn secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Account;