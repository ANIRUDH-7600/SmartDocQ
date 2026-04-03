import { apiUrl } from "../config";

export async function updateProfile(payload) {
  const res = await fetch(apiUrl("/api/auth/me"), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update profile");
  return data.user;
}

export async function uploadAvatar(file) {
  const form = new FormData();
  form.append("avatar", file, file.name || "avatar.jpg");

  const res = await fetch(apiUrl("/api/auth/me/avatar"), {
    method: "POST",
    credentials: "include",
    body: form,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to upload avatar");
  return { avatar: data.avatar };
}

export async function clearChatHistory() {
  const res = await fetch(apiUrl("/api/chat"), {
    method: "DELETE",
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Failed to clear chat history");
  return data;
}

export async function deleteAccount() {
  const res = await fetch(apiUrl("/api/auth/me"), {
    method: "DELETE",
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to delete account");
  return data;
}