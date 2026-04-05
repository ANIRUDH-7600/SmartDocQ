import { useEffect, useState } from "react";

export default function useUploadUIState() {
  const [uploaded, setUploaded] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [previewWidth, setPreviewWidth] = useState(40);
  const [lastPreviewWidth, setLastPreviewWidth] = useState(40);

  useEffect(() => {
    localStorage.setItem("sd_ui_history_open", isHistoryOpen ? "1" : "0");
  }, [isHistoryOpen]);

  useEffect(() => {
    localStorage.setItem("sd_ui_preview_open", isPreviewOpen ? "1" : "0");
  }, [isPreviewOpen]);

  useEffect(() => {
    localStorage.setItem("sd_ui_preview_width", String(previewWidth));
  }, [previewWidth]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        setIsHistoryOpen((v) => !v);
      }

      if (e.ctrlKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        if (isPreviewOpen) {
          setLastPreviewWidth(previewWidth);
          setIsPreviewOpen(false);
        } else {
          setIsPreviewOpen(true);
          if (lastPreviewWidth) setPreviewWidth(lastPreviewWidth);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPreviewOpen, previewWidth, lastPreviewWidth]);

  return {
    uploaded,
    setUploaded,
    isHistoryOpen,
    setIsHistoryOpen,
    isPreviewOpen,
    setIsPreviewOpen,
    previewWidth,
    setPreviewWidth,
    lastPreviewWidth,
    setLastPreviewWidth,
  };
}