
export function mapDocumentFromApi(doc = {}) {
  if (!doc.name && process.env.NODE_ENV !== "production") {
    console.warn("Missing document name for:", doc.doc_id || doc._id, doc);
  }

  const uploadedAt = doc.uploadedAt || doc.createdAt;
  if (!uploadedAt && process.env.NODE_ENV !== "production") {
    console.warn("Missing uploadedAt/createdAt timestamp for:", doc.doc_id || doc._id, doc);
  }

  return {
    id: doc.doc_id || doc._id || null,
    name: doc.name || "Untitled Document",
    type: doc.type || "application/octet-stream",
    size: Number(doc.size) || 0,
    uploadedAt: uploadedAt || new Date().toISOString(),
    documentId: doc._id || doc.documentId || null,
    originalName: doc.originalName || null,
    originalType: doc.originalType || null,
    pinned: !!doc.pinned,
    pinnedAt: doc.pinnedAt || null,
  };
}

export function buildCurrentDocFromUpload(file = {}, data = {}) {
  const safeName =
    typeof file.name === "string" && file.name.trim()
      ? file.name
      : "Untitled Document";

  const isConverted = !!data.converted;

  const displayName = isConverted
    ? safeName.replace(/\.(doc|docx)$/i, ".pdf")
    : safeName;

  const resolvedId = data.documentId || data._id || data.doc_id || null;

  return {
    id: resolvedId,
    name: displayName,
    type: isConverted
      ? "application/pdf"
      : file.type || "application/octet-stream",
    size: Number(file.size) || 0,
    uploadedAt: new Date().toISOString(),
    documentId: resolvedId,
    originalName: file.name || null,
    originalType: file.type || null,
  };
}