import { pyApiUrl } from "../config";

async function pyFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (err) {
    throw new Error("Network error: Unable to reach summarization service. Please try again.");
  }
}

async function handleJsonResponse(res, fallbackMessage = "Summarization failed") {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || data.error || fallbackMessage);
  }

  return data;
}

export async function summarizeSelection(selectionText, docId = null) {
  if (!selectionText || !String(selectionText).trim()) {
    throw new Error("Selection text is required for summarization");
  }

  const res = await pyFetch(pyApiUrl("/api/summarize"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      selectionText: String(selectionText).trim(),
      docId: docId || null,
    }),
  });

  return handleJsonResponse(res, "Failed to summarize selection");
}