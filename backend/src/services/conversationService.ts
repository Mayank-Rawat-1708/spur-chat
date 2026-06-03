import { v4 as uuidv4 } from "uuid";
import { db } from "../db/database";
import type { Conversation, Message, FAQKnowledge, LLMMessage } from "../types";

const MAX_HISTORY_MESSAGES = 20; // Cap for cost control

export function getOrCreateConversation(sessionId?: string): Conversation {
  if (sessionId) {
    const existing = db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(sessionId) as Conversation | undefined;

    if (existing) {
      // Touch updated_at
      db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(sessionId);
      return existing;
    }
  }

  const id = sessionId || uuidv4();
  db.prepare(`
    INSERT INTO conversations (id, created_at, updated_at)
    VALUES (?, datetime('now'), datetime('now'))
  `).run(id);

  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Conversation;
}

export function saveMessage(
  conversationId: string,
  sender: "user" | "ai",
  text: string
): Message {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO messages (id, conversation_id, sender, text, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(id, conversationId, sender, text);

  return db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as Message;
}

export function getMessages(conversationId: string): Message[] {
  return db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
    .all(conversationId) as Message[];
}

export function getRecentMessagesForLLM(conversationId: string): LLMMessage[] {
  const messages = db
    .prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(conversationId, MAX_HISTORY_MESSAGES) as Message[];

  // Reverse to chronological order
  return messages.reverse().map((m) => ({
    role: m.sender === "user" ? "user" : "assistant",
    content: m.text,
  }));
}

export function getAllFAQKnowledge(): FAQKnowledge[] {
  return db.prepare("SELECT * FROM faq_knowledge ORDER BY category, id").all() as FAQKnowledge[];
}
