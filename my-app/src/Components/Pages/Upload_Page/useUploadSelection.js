import { useEffect, useRef, useState } from "react";
import {
  buildFileKey,
  SUPPORTED_FILE_TYPES,
  validateFiles,
} from "./fileHelpers";

export default function useUploadSelection(showToast) {
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [fileUrl, setFileUrl] = useState("");

  const isOverDrop = useRef(false);
  const fileInputRef = useRef(null);

  const validateAndSetFiles = (incoming) => {
    const { accepted, rejected } = validateFiles(incoming, SUPPORTED_FILE_TYPES, 25);

    if (rejected.length) {
      showToast?.(
        `Some files were skipped: ${rejected.slice(0, 3).join("; ")}${rejected.length > 3 ? "…" : ""}`,
        { type: "warning" }
      );
    }

    if (!accepted.length) return;

    setFiles((prev) => {
      const combo = [...prev, ...accepted];
      const seen = new Set();
      const uniq = [];

      for (const f of combo) {
        const key = buildFileKey(f);
        if (!seen.has(key)) {
          seen.add(key);
          uniq.push(f);
        }
      }

      if (!file && uniq.length) {
        const first = uniq[0];
        setFile(first);
        const url = URL.createObjectURL(first);
        setFileUrl((prevUrl) => {
          if (prevUrl) URL.revokeObjectURL(prevUrl);
          return url;
        });
      }

      return uniq;
    });
  };

  const handleFileChange = (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    validateAndSetFiles(list);
  };

  const clearSelectedFiles = () => {
    setFiles([]);
    setFile(null);
    setFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearFileSelection = () => {
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeSelectedFile = (targetKey) => {
    setFiles((prev) => {
      const next = prev.filter((f) => buildFileKey(f) !== targetKey);

      if (file && buildFileKey(file) === targetKey) {
        if (next.length) setFile(next[0]);
        else setFile(null);
      }

      return next;
    });
  };

  const onDragOver = (e) => {
    e.preventDefault();
    isOverDrop.current = true;
  };

  const onDragLeave = () => {
    isOverDrop.current = false;
  };

  const onDrop = (e) => {
    e.preventDefault();
    isOverDrop.current = false;
    const list = Array.from(e.dataTransfer.files || []);
    if (list.length) validateAndSetFiles(list);
  };

  useEffect(() => {
    return () => {
      setFileUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
    };
  }, []);

  return {
    file,
    setFile,
    files,
    setFiles,
    fileUrl,
    setFileUrl,
    isOverDrop,
    fileInputRef,
    handleFileChange,
    validateAndSetFiles,
    clearSelectedFiles,
    clearFileSelection,
    removeSelectedFile,
    onDragOver,
    onDragLeave,
    onDrop,
  };
}