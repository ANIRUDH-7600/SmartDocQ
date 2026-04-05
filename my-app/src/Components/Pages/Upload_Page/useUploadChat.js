import { useState } from "react";
import {
  appendChatMessages,
  deleteChatHistory,
  sendChatMessage,
} from "../../../Services/ChatService";
import { summarizeSelection } from "../../../Services/SummarizeService";

export default function useUploadChat(showToast, currentDoc) {
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const sendMessageHandler = async () => {
    const text = chatInput.trim();
    if (!text || isTyping) return;

    const docId = currentDoc?.documentId || currentDoc?._id || currentDoc?.id;

    if (!docId) {
      setChat((prev) => [
        ...prev,
        { role: "assistant", text: "⚠️ No document selected", at: Date.now() },
      ]);
      return;
    }

    const now = Date.now();
    setChat((prev) => [...prev, { role: "user", text, at: now }]);
    setChatInput("");
    setIsTyping(true);

    try {
      const res = await sendChatMessage(docId, text);
      const data = await res.json().catch(() => ({}));
      const appended = Array.isArray(data.appended) ? data.appended : [];

      if (appended.length) {
        setChat((prev) => [...prev, ...appended.filter((m) => m?.role === "assistant")]);
      }
    } catch (err) {
      setChat((prev) => [
        ...prev,
        { role: "assistant", text: "⚠️ Error: " + err.message, at: Date.now() },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const clearChat = async () => {
    const docId = currentDoc?.documentId || currentDoc?._id || currentDoc?.id;
    setChat([]);

    if (docId) {
      try {
        await deleteChatHistory(docId);
      } catch (err) {
        console.error("Failed to delete chat from Atlas:", err);
      }
    }
  };

  const summarizeSelectionHandler = async (selectedText) => {
    try {
      const docId = currentDoc?.documentId || currentDoc?._id || currentDoc?.id;

      if (!selectedText) {
        showToast?.(
          "Select text in the page to summarize. For PDFs opened in the built-in viewer, selection may not be accessible—copy the text or use text/Word preview.",
          { type: "info" }
        );
        return;
      }

      const userMsgText = `Summarize the following selection:\n\n"""\n${selectedText}\n"""`;
      const userAt = Date.now();

      setChat((prev) => [...prev, { role: "user", text: userMsgText, at: userAt }]);
      setIsTyping(true);

      const res = await summarizeSelection(selectedText, docId);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error || "Summarization failed");

      const summary = data?.summary || "No summary produced.";
      const asstAt = Date.now();

      setChat((prev) => [...prev, { role: "assistant", text: summary, at: asstAt }]);

      if (docId) {
        try {
          await appendChatMessages(docId, [
            { role: "user", text: userMsgText, at: userAt },
            { role: "assistant", text: summary, at: asstAt, rating: "none" },
          ]);
        } catch (persistErr) {
          console.warn("Failed to persist summarize messages:", persistErr);
        }
      }
    } catch (e) {
      setChat((prev) => [
        ...prev,
        { role: "assistant", text: `⚠️ ${e.message || "Summarization failed"}`, at: Date.now() },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return {
    chat,
    setChat,
    chatInput,
    setChatInput,
    isTyping,
    setIsTyping,
    sendMessageHandler,
    clearChat,
    summarizeSelectionHandler,
  };
}