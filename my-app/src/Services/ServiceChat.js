import { apiFetch } from "../config";

function validateShareId(shareId) {
  if (!shareId) {
    throw new Error("Invalid share link");
  }

  if (!/^[a-zA-Z0-9_-]{6,64}$/.test(shareId)) {
    throw new Error("Invalid share link");
  }
}

export async function getSharedChat(shareId, { signal } = {}) {
  validateShareId(shareId);

  const res = await apiFetch(`/api/share/${shareId}`, { signal });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.message || "Failed to load shared chat");
  }

  return json;
}

export async function exportSharedChat(shareId, { signal } = {}) {
  validateShareId(shareId);

  const res = await apiFetch(`/api/share/${shareId}/export.pdf`, { signal });

  if (!res.ok) {
    const j = await res.json().catch(() => ({ message: "Failed to export" }));
    throw new Error(j.message || "Failed to export");
  }

  return res.blob();
}