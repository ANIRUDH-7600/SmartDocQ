import React, { useState } from "react";
import "./UploadPage.css";
import { useToast } from "../../ToastContext";

import History from "../../History";
import Preview from "../../Preview";
import Chat from "../../Chat";

import useUploadUIState from "./useUploadUIState";
import useUploadSelection from "./useUploadSelection";
import useUploadHistory from "./useUploadHistory";
import useUploadChat from "./useUploadChat";

import {
  uploadBatchDocuments,
  uploadSingleDocument,
  downloadDocument,
} from "../../../Services/DocumentService";

import { buildCurrentDocFromUpload } from "./documentMappers";
import { sanitizeFilename, formatBytes } from "./fileHelpers";

const UploadPage = () => {
  const { showToast } = useToast();
  const [currentDoc, setCurrentDoc] = useState(null);
  const [uploaded, setUploaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const {
    isHistoryOpen,
    setIsHistoryOpen,
    isPreviewOpen,
    setIsPreviewOpen,
    previewWidth,
    setPreviewWidth,
    lastPreviewWidth,
    setLastPreviewWidth,
  } = useUploadUIState();

  const {
    file,
    files,
    fileUrl,
    isOverDrop,
    fileInputRef,
    handleFileChange,
    clearSelectedFiles,
    clearFileSelection,
    removeSelectedFile,
    onDragOver,
    onDragLeave,
    onDrop,
    selectFile,
  } = useUploadSelection(showToast);

  const {
    chat,
    setChat,
    chatInput,
    setChatInput,
    isTyping,
    sendMessageHandler,
    clearChat,
    summarizeSelectionHandler,
  } = useUploadChat(showToast, currentDoc);

  const {
    history,
    fetchHistory,
    removeHistoryItem,
    renameHistoryItem,
    handlePinToggle,
    selectHistoryItem,
  } = useUploadHistory(showToast, {
    setCurrentDoc,
    setUploaded,
    selectFile,
    setChat,
    setIsPreviewOpen,
  });

  const handleUpload = async () => {
    const selected = files.length ? files : file ? [file] : [];

    if (!selected.length) {
      showToast?.("Please select file(s) first", { type: "warning" });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const useBatch = selected.length > 1;
    const start = Date.now();

    const interval = setInterval(() => {
      setUploadProgress((p) => {
        const elapsed = Date.now() - start;
        return Math.min(95, p + Math.max(1, Math.floor(elapsed / 500)));
      });
    }, 200);

    try {
      const res = useBatch
        ? await uploadBatchDocuments(selected)
        : await uploadSingleDocument(selected[0]);

      const data = await res.json();

      if (res.status === 409 && data.duplicate) {
        clearInterval(interval);
        setIsUploading(false);

        let message = data.message || "This file is already being processed.";
        if (data.existingName && data.processingTimeMinutes !== undefined) {
          message = `"${data.existingName}" is ${data.status} (${data.processingTimeMinutes} min). Please wait.`;
        }

        showToast?.(message, { type: "warning" });

        if (data.existingDocumentId && data.existingDocId) {
          setCurrentDoc({
            id: data.existingDocId,
            name: data.existingName,
            documentId: data.existingDocumentId,
            processingStatus: data.status,
          });
          fetchHistory();
        }

        return;
      }

      if (!res.ok) throw new Error(data.message || "Upload failed");

      clearInterval(interval);
      setUploadProgress(100);
      setIsUploading(false);

      if (useBatch) {
        const count = Array.isArray(data.items) ? data.items.length : selected.length;
        const convertedCount = Array.isArray(data.items)
          ? data.items.filter((item) => item.converted).length
          : 0;

        let message = `Uploaded ${count} file(s)`;
        if (convertedCount > 0) {
          message += ` (${convertedCount} Word document${convertedCount > 1 ? "s" : ""} converted to PDF)`;
        }

        showToast?.(message, { type: "success" });
        clearFileSelection();
      } else {
        const f0 = selected[0];
        let message = `Uploaded ${sanitizeFilename(f0.name)}`;
        if (data.converted) message += " (converted to PDF)";

        showToast?.(message, { type: "success" });

        const currentDocData = buildCurrentDocFromUpload(f0, data);
        setCurrentDoc(currentDocData);
        setUploaded(true);

        if (data.converted) {
          try {
            const downloadRes = await downloadDocument(data.documentId);
            if (downloadRes.ok) {
              const blob = await downloadRes.blob();
              const previewFile = new File([blob], currentDocData.name || "document.pdf", {
                type: "application/pdf",
              });
              selectFile(previewFile);
              setIsPreviewOpen(true);
              showToast?.(`Displaying converted PDF: ${currentDocData.name}`, { type: "info" });
            }
          } catch (err) {
            console.error("Error loading converted PDF:", err);
          }
        }
      }

      clearFileSelection();
      fetchHistory();
    } catch (err) {
      clearInterval(interval);
      setIsUploading(false);
      showToast?.(err.message, { type: "error" });
    }
  };

  return (
    <div className={`upload-container-dark ${uploaded ? "three-cols" : "two-cols"}`}>
      <History
        history={history}
        isOpen={isHistoryOpen}
        onToggle={() => setIsHistoryOpen(!isHistoryOpen)}
        onSelect={selectHistoryItem}
        onRemove={(id) => removeHistoryItem(id, currentDoc)}
        onRename={renameHistoryItem}
        onPinToggle={handlePinToggle}
        formatBytes={formatBytes}
      />

      <div className={`right-section ${isHistoryOpen ? "" : "full-width"}`}>
        {!uploaded ? (
          <div className="upload-section">
            <h1 className="upload-title">📂 Upload Your Document</h1>
            <p className="upload-subtitle">
              Upload PDFs, Word files, or Text documents for SmartDocQ analysis.
            </p>

            <div
              className={`upload-box ${isOverDrop ? "drag-over" : ""}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <div className={`file-input-wrapper ${files.length ? "has-file" : ""}`}>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileChange}
                  className="file-input"
                  id="file-upload"
                  ref={fileInputRef}
                />
                <label htmlFor="file-upload" className="file-input-button">
                  <svg viewBox="0 0 24 24">
                    <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
                  </svg>
                  {files.length ? "Add More Files" : "Choose Files"}
                </label>
              </div>

              {files.length > 0 &&
                (files.length === 1 ? (
                  <div className="file-info-simple">
                    <span className="file-name">{sanitizeFilename(files[0].name)}</span>
                    <span className="file-size">{formatBytes(files[0].size)}</span>
                    <button
                      type="button"
                      className="remove-file"
                      aria-label="Remove selected file"
                      onClick={clearSelectedFiles}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="file-list">
                    {files.map((f) => {
                      const key = `${f.name}|${f.size}|${f.lastModified}`;
                      return (
                        <div className="file-chip" key={key} title={f.name}>
                          <span className="chip-name">{sanitizeFilename(f.name)}</span>
                          <span className="chip-size">{formatBytes(f.size)}</span>
                          <button
                            type="button"
                            className="chip-remove"
                            aria-label={`Remove ${f.name}`}
                            onClick={() => removeSelectedFile(key)}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    <div className="file-summary">
                      {files.length} files • {formatBytes(files.reduce((s, f) => s + f.size, 0))}
                      <button
                        type="button"
                        className="file-summary-clear"
                        onClick={clearSelectedFiles}
                        aria-label="Clear all files"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                ))}

              <div className="upload-actions">
                <button
                  className="upload-button"
                  onClick={handleUpload}
                  disabled={(!files.length && !file) || isUploading}
                >
                  {isUploading ? "Uploading..." : files.length > 1 ? "Upload All" : "Upload"}
                </button>
                <span className="upload-hint">or drag & drop here</span>
              </div>

              {isUploading && (
                <div style={{ marginTop: 16 }}>
                  <progress
                    className="progress-native"
                    max={100}
                    value={Math.max(0, Math.min(100, uploadProgress))}
                  />
                  <div className="progress-native-label">{uploadProgress}%</div>
                </div>
              )}

              <div className="file-restrictions">
                <p>Allowed file types: PDF, Word, and Text files</p>
                <p>Maximum file size: 25MB</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="three-cols-container">
            <Preview
              file={file}
              fileUrl={fileUrl}
              isOpen={isPreviewOpen}
              previewWidth={previewWidth}
              lastPreviewWidth={lastPreviewWidth}
              setPreviewWidth={setPreviewWidth}
              setLastPreviewWidth={setLastPreviewWidth}
              setIsPreviewOpen={setIsPreviewOpen}
              documentId={currentDoc?.documentId || currentDoc?._id || currentDoc?.id}
              filename={currentDoc?.name}
              onTextSaved={fetchHistory}
              onSummarizeSelection={summarizeSelectionHandler}
            />

            <Chat
              chat={chat}
              setChat={setChat}
              chatInput={chatInput}
              setChatInput={setChatInput}
              sendMessage={sendMessageHandler}
              clearChat={clearChat}
              isTyping={isTyping}
              documentId={currentDoc?.documentId || currentDoc?._id || currentDoc?.id}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPage;