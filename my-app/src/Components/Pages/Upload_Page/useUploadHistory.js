import { useCallback, useEffect, useState } from "react";
import {
  deleteDocument,
  downloadDocument,
  fetchDocuments,
  getPythonPreviewUrl,
  pinDocument,
  renameDocument,
  unpinDocument,
} from "../../../Services/DocumentService";
import { fetchChatHistory } from "../../../Services/ChatService";
import { sanitizeFilename, validateFilename } from "./fileHelpers";
import { mapDocumentFromApi } from "./documentMappers";

export default function useUploadHistory(showToast, setters) {
  const {
    setCurrentDoc,
    setUploaded,
    selectFile,
    setChat,
    setIsPreviewOpen,
  } = setters;

  const [history, setHistory] = useState([]);

  const fetchHistory = useCallback(async () => {
    try {
      const docs = await fetchDocuments();
      setHistory(docs.map(mapDocumentFromApi));
    } catch (err) {
      showToast?.(err.message, { type: "error" });
    }
  }, [showToast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const removeHistoryItem = async (id, currentDoc) => {
    try {
      await deleteDocument(id);

      const currentDocId = currentDoc?.documentId || currentDoc?._id || currentDoc?.id;
      if (currentDocId === id) {
        setChat([]);
        setCurrentDoc(null);
        setUploaded(false);
        setIsPreviewOpen(false);
      }

      showToast?.("Document deleted successfully", { type: "success" });
      fetchHistory();
    } catch (err) {
      showToast?.(err.message, { type: "error" });
    }
  };

  const renameHistoryItem = async (id, newName) => {
    try {
      if (!validateFilename(newName)) {
        showToast?.("Invalid filename.", { type: "error" });
        return;
      }

      await renameDocument(id, newName);

      showToast?.(`Renamed to "${sanitizeFilename(newName)}"`, { type: "success" });
      fetchHistory();
    } catch (err) {
      showToast?.(err.message, { type: "error" });
    }
  };

  const handlePinToggle = async (id) => {
    try {
      const item = history.find((h) => h.id === id);
      if (!item) return;

      if (item.pinned) {
        await unpinDocument(item.documentId);
      } else {
        await pinDocument(item.documentId);
      }

      setHistory((prev) =>
        prev.map((x) =>
          x.id === id
            ? { ...x, pinned: !x.pinned, pinnedAt: !x.pinned ? new Date().toISOString() : null }
            : x
        )
      );

      fetchHistory();
    } catch (e) {
      showToast?.(e.message || "Failed to toggle pin", { type: "error" });
    }
  };

  const selectHistoryItem = async (item) => {
    try {
      setCurrentDoc(item);
      setUploaded(true);
      setIsPreviewOpen(true);
      selectFile({ name: item.name, type: "loading" });

      const isOriginallyWord =
        item.originalType === "application/msword" ||
        item.originalType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      const isConvertedToPdf = isOriginallyWord && item.type === "application/pdf";

      if (isConvertedToPdf || item.type === "application/pdf") {
        const downloadRes = await downloadDocument(item.documentId);
        if (!downloadRes.ok) throw new Error("Failed to load PDF");

        const blob = await downloadRes.blob();
        const f = new File([blob], item.name || "document.pdf", {
          type: "application/pdf",
        });
        selectFile(f);

        if (isConvertedToPdf) {
          showToast?.(`Showing converted PDF: ${item.name}`, { type: "info" });
        }
      } else {
        const isWord =
          item.type === "application/msword" ||
          item.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          /\.(docx?|DOCX?)$/.test(item.name || "");

        if (isWord) {
          try {
            const previewUrl = getPythonPreviewUrl(item.id || item.documentId);
            const previewRes = await fetch(previewUrl);

            if (previewRes.ok) {
              const blob = await previewRes.blob();
              const f = new File([blob], item.name || "document.pdf", {
                type: "application/pdf",
              });
              selectFile(f);
            } else {
              throw new Error("Preview not available");
            }
          } catch {
            const res = await downloadDocument(item.documentId || item.id);
            if (!res.ok) throw new Error("Failed to download document");

            const blob = await res.blob();
            const f = new File([blob], item.name || "document", {
              type: item.type || blob.type || "application/octet-stream",
            });

            selectFile(f);
          }
        } else {
          const res = await downloadDocument(item.documentId || item.id);
          if (!res.ok) throw new Error("Failed to download document");

          const blob = await res.blob();
          const f = new File([blob], item.name || "document", {
            type: item.type || blob.type || "application/octet-stream",
          });

          selectFile(f);
        }
      }

      showToast?.(`Opened ${sanitizeFilename(item.name)}`, { type: "info" });

      try {
        const chatRes = await fetchChatHistory(item.documentId || item._id || item.id);
        if (chatRes.ok) {
          const data = await chatRes.json();
          setChat(Array.isArray(data.messages) ? data.messages : []);
        } else {
          setChat([]);
        }
      } catch {
        setChat([]);
      }
    } catch (err) {
      showToast?.(err.message, { type: "error" });
    }
  };

  return {
    history,
    setHistory,
    fetchHistory,
    removeHistoryItem,
    renameHistoryItem,
    handlePinToggle,
    selectHistoryItem,
  };
}