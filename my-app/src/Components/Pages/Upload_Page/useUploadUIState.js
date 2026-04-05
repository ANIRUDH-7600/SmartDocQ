import { useEffect, useState } from "react";

const DEFAULT_PREVIEW_WIDTH = 40;
const MIN_PREVIEW_WIDTH = 20;
const MAX_PREVIEW_WIDTH = 80;

function clampWidth(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_PREVIEW_WIDTH;
  return Math.min(MAX_PREVIEW_WIDTH, Math.max(MIN_PREVIEW_WIDTH, num));
}

function getStoredBool(key, fallback = true) {
  try {
    const value = localStorage.getItem(key);
    if (value === "1") return true;
    if (value === "0") return false;
  } catch {
    // ignore storage access errors
  }
  return fallback;
}

function getStoredWidth(key, fallback = DEFAULT_PREVIEW_WIDTH) {
  try {
    const value = localStorage.getItem(key);
    return clampWidth(value ?? fallback);
  } catch {
    return fallback;
  }
}

export default function useUploadUIState() {
  const [isHistoryOpen, setIsHistoryOpen] = useState(() =>
    getStoredBool("sd_ui_history_open", true)
  );

  const [isPreviewOpen, setIsPreviewOpen] = useState(() =>
    getStoredBool("sd_ui_preview_open", true)
  );

  const [previewWidth, setPreviewWidth] = useState(() =>
    getStoredWidth("sd_ui_preview_width", DEFAULT_PREVIEW_WIDTH)
  );

  const [lastPreviewWidth, setLastPreviewWidth] = useState(() =>
    getStoredWidth("sd_ui_preview_width", DEFAULT_PREVIEW_WIDTH)
  );

  useEffect(() => {
    try {
      localStorage.setItem("sd_ui_history_open", isHistoryOpen ? "1" : "0");
    } catch {
      // ignore storage write errors
    }
  }, [isHistoryOpen]);

  useEffect(() => {
    try {
      localStorage.setItem("sd_ui_preview_open", isPreviewOpen ? "1" : "0");
    } catch {
      // ignore storage write errors
    }
  }, [isPreviewOpen]);

  useEffect(() => {
    try {
      localStorage.setItem("sd_ui_preview_width", String(clampWidth(previewWidth)));
    } catch {
      // ignore storage write errors
    }
  }, [previewWidth]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        e.target?.isContentEditable;

      if (isEditable) return;

      if (e.ctrlKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        setIsHistoryOpen((v) => !v);
      }

      if (e.ctrlKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();

        setIsPreviewOpen((prev) => {
          if (prev) {
            setLastPreviewWidth(clampWidth(previewWidth));
            return false;
          }

          setPreviewWidth(clampWidth(lastPreviewWidth));
          return true;
        });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewWidth, lastPreviewWidth]);

  return {
    isHistoryOpen,
    setIsHistoryOpen,
    isPreviewOpen,
    setIsPreviewOpen,
    previewWidth,
    setPreviewWidth: (value) => setPreviewWidth(clampWidth(value)),
    lastPreviewWidth,
    setLastPreviewWidth,
  };
}