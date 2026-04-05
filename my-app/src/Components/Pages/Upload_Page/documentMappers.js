export function mapDocumentFromApi(doc) {
  return {
    id: doc.doc_id || doc._id,
    name: doc.name,
    type: doc.type,
    size: doc.size,
    uploadedAt: doc.uploadedAt || doc.createdAt || new Date().toISOString(),
    documentId: doc._id,
    originalName: doc.originalName,
    originalType: doc.originalType,
    pinned: !!doc.pinned,
    pinnedAt: doc.pinnedAt || null,
  };
}

export function buildCurrentDocFromUpload(file, data) {
  return {
    id: data.doc_id || data.documentId,
    name: data.converted ? file.name.replace(/\.(docx?|DOCX?)$/, ".pdf") : file.name,
    type: data.converted ? "application/pdf" : file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    documentId: data.documentId,
  };
}