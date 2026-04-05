export const SUPPORTED_FILE_TYPES = [
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function sanitizeFilename(filename = "") {
  return String(filename)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#x2F;");
}

export function validateFilename(filename = "") {
  const trimmed = String(filename).trim();
  const invalidChars = /[<>:"/\\|?*]/;

  if (!trimmed) return false;
  if (trimmed === "." || trimmed === "..") return false;
  if (invalidChars.test(trimmed)) return false;
  if (trimmed.length > 255) return false;

  return true;
}

export function formatBytes(bytes) {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value <= 0) return "0 B";

  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), sizes.length - 1);

  return `${(value / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export function buildFileKey(file) {
  if (!file) return "";
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function validateFiles(incoming, supportedTypes = SUPPORTED_FILE_TYPES, maxSizeMb = 25) {
  const files = Array.isArray(incoming) ? incoming : [];
  const accepted = [];
  const rejected = [];
  const maxBytes = maxSizeMb * 1024 * 1024;
  const sizeLimitLabel = formatBytes(maxBytes);

  for (const f of files) {
    if (!f) continue;

    if (!supportedTypes.includes(f.type)) {
      rejected.push(`${f.name}: unsupported type`);
      continue;
    }

    if (f.size > maxBytes) {
      rejected.push(`${f.name}: too large (> ${sizeLimitLabel})`);
      continue;
    }

    if (!validateFilename(f.name)) {
      rejected.push(`${f.name}: invalid filename`);
      continue;
    }

    accepted.push(f);
  }

  return { accepted, rejected };
}