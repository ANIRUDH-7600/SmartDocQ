import { useRef, useState } from "react";
import {
  appendChatMessages,
  deleteChatHistory,
  sendChatMessage,
} from "../../../Services/ChatService";
import { summarizeSelection } from "../../../Services/SummarizeService";

function resolveDocId(doc) {
  return doc?.documentId || doc?._id || doc?.id || null;
}

export default function useUploadChat(showToast, currentDoc) {
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const latestRequestRef = useRef(0);

  const sendMessageHandler = async () => {
    const text = chatInput.trim();
    if (!text || isTyping) return;

    const docId = resolveDocId(currentDoc);

    if (!docId) {
      showToast?.("No document selected", { type: "warning" });
      return;
    }

    const now = Date.now();
    setChat((prev) => [...prev, { role: "user", text, at: now }]);
    setChatInput("");
    setIsTyping(true);
    const requestId = ++latestRequestRef.current;

    try {
      const data = await sendChatMessage(docId, text);
      const appended = Array.isArray(data.appended) ? data.appended : [];

      if (latestRequestRef.current !== requestId || resolveDocId(currentDoc) !== docId) {
        return;
      }

      if (appended.length) {
        setChat((prev) => [...prev, ...appended.filter((m) => m?.role === "assistant")]);
      }
    } catch (err) {
      if (latestRequestRef.current !== requestId || resolveDocId(currentDoc) !== docId) {
        return;
      }

      setChat((prev) => [
        ...prev,
        { role: "assistant", text: "⚠️ Error: " + err.message, at: Date.now() },
      ]);
    } finally {
      if (latestRequestRef.current === requestId) {
        setIsTyping(false);
      }
    }
  };

  const clearChat = async () => {
    const docId = resolveDocId(currentDoc);

    try {
      if (docId) {
        await deleteChatHistory(docId);
      }
      setChat([]);
    } catch (err) {
      showToast?.(err.message || "Failed to clear chat", { type: "error" });

      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to clear chat history:", err);
      }
    }
  };

  const summarizeSelectionHandler = async (selectedText) => {
    let requestId = 0;
    const docId = resolveDocId(currentDoc);
    const cleanText = String(selectedText || "").trim();

    try {
      if (!cleanText) {
        showToast?.(
          "Select text in the page to summarize. For PDFs opened in the built-in viewer, selection may not be accessible—copy the text or use text/Word preview.",
          { type: "info" }
        );
        return;
      }

      const userMsgText = `Summarize the following selection:\n\n"""\n${cleanText}\n"""`;
      const userAt = Date.now();

      setChat((prev) => [...prev, { role: "user", text: userMsgText, at: userAt }]);
      setIsTyping(true);
      requestId = ++latestRequestRef.current;

      const data = await summarizeSelection(cleanText, docId);
      const summary = data?.summary || "No summary produced.";
      const asstAt = Date.now();

      if (latestRequestRef.current !== requestId || resolveDocId(currentDoc) !== docId) {
        return;
      }

      setChat((prev) => [...prev, { role: "assistant", text: summary, at: asstAt }]);

      if (docId) {
        try {
          await appendChatMessages(docId, [
            { role: "user", text: userMsgText, at: userAt },
            { role: "assistant", text: summary, at: asstAt, rating: "none" },
          ]);
        } catch (persistErr) {
          showToast?.("Failed to save summary to chat history", { type: "error" });

          if (process.env.NODE_ENV !== "production") {
            console.warn("Failed to persist summarize messages:", persistErr);
          }
        }
      }
    } catch (e) {
      if (latestRequestRef.current !== requestId || resolveDocId(currentDoc) !== docId) {
        return;
      }

      setChat((prev) => [
        ...prev,
        { role: "assistant", text: `⚠️ ${e.message || "Summarization failed"}`, at: Date.now() },
      ]);
    } finally {
      if (latestRequestRef.current === requestId) {
        setIsTyping(false);
      }
    }
  };

  return {
    chat,
    setChat,
    chatInput,
    setChatInput,
    isTyping,
    sendMessageHandler,
    clearChat,
    summarizeSelectionHandler,
  };
}