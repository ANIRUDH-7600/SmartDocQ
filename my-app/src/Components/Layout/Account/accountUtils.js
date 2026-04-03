export const MAX_AVATAR_BYTES = 1024 * 1024; // 1MB

export const isValidEmail = (email = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const formatName = (value = "") => {
  if (!value) return "";

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "";

  // Title-case each word's first character
  let formatted = normalized.replace(/\b\w/g, (c) => c.toUpperCase());
  if (formatted.length > 15) formatted = formatted.slice(0, 15);
  return formatted;
};

export const formatJoinedDate = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatLastLogin = (date) => {
  if (!date) return "Never";

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "Never";

  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const compressImage = (
  file,
  { maxSize = 512, quality = 0.8, mime = "image/jpeg" } = {}
) => {
  return new Promise((resolve, reject) => {
    try {
      if (!file) return reject(new Error("No file provided"));

      if (!file.type || !file.type.startsWith("image/")) {
        return reject(new Error("File must be an image"));
      }

      // Hard upper bound as a final safety net (5MB)
      const MAX_SAFE_BYTES = 5 * 1024 * 1024;
      if (file.size && file.size > MAX_SAFE_BYTES) {
        return reject(new Error("Image too large"));
      }

      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        // Release the object URL as soon as the image is loaded
        URL.revokeObjectURL(url);

        const canvas = document.createElement("canvas");
        let { width, height } = img;

        const scale = Math.min(1, maxSize / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error("Failed to compress image"));

          const ext = mime.endsWith("png")
            ? "png"
            : mime.endsWith("webp")
            ? "webp"
            : "jpg";

          const out = new File([blob], `avatar.${ext}`, {
            type: blob.type || mime,
            lastModified: Date.now(),
          });

          resolve(out);
        }, mime, quality);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        return reject(new Error("Invalid image"));
      };

      img.src = url;
    } catch (e) {
      return reject(e);
    }
  });
};