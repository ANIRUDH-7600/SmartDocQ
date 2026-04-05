export const SUPPORTED_FILE_TYPES = [
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function sanitizeFilename(filename = "") {
  return filename
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#x2F;");
}

export function validateFilename(filename = "") {
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(filename)) return false;
  if (filename.length > 255) return false;
  return true;
}

export function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export function buildFileKey(file) {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function validateFiles(incoming, supportedTypes = SUPPORTED_FILE_TYPES, maxSizeMb = 25) {
  const accepted = [];
  const rejected = [];

  for (const f of incoming) {
    if (!supportedTypes.includes(f.type)) {
      rejected.push(`${f.name}: unsupported type`);
      continue;
    }

    if (f.size > maxSizeMb * 1024 * 1024) {
      rejected.push(`${f.name}: too large (> ${maxSizeMb}MB)`);
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