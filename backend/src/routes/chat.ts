import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  getOrCreateConversation,
  saveMessage,
  getMessages,
  getRecentMessagesForLLM,
  getAllFAQKnowledge,
} from "../services/conversationService";
import { generateReply } from "../services/llmService";
import type { ChatResponse, HistoryResponse } from "../types";

const router = Router();

const ChatRequestSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(5000, "Message too long (max 5000 characters)")
    .transform((s) => s.trim()),
  sessionId: z.string().uuid().optional().or(z.literal("")).transform((s) => s || undefined),
});

// POST /chat/message
router.post("/message", async (req: Request, res: Response): Promise<void> => {
  // Validate input
  const parseResult = ChatRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Invalid request",
      details: parseResult.error.errors.map((e) => e.message),
    });
    return;
  }

  const { message, sessionId } = parseResult.data;

  // Empty message after trim check
  if (!message) {
    res.status(400).json({ error: "Message cannot be empty or whitespace only" });
    return;
  }

  try {
    // Get or create conversation
    const conversation = getOrCreateConversation(sessionId);

    // Save user message
    saveMessage(conversation.id, "user", message);

    // Get conversation history for LLM
    const history = getRecentMessagesForLLM(conversation.id);
    // Remove the last message (the one we just saved) from history since we'll pass it separately
    const historyWithoutCurrent = history.slice(0, -1);

    // Get FAQ knowledge
    const faqKnowledge = getAllFAQKnowledge();

    // Generate AI reply
    const reply = await generateReply(historyWithoutCurrent, message, faqKnowledge);

    // Save AI message
    const aiMessage = saveMessage(conversation.id, "ai", reply);

    const response: ChatResponse = {
      reply,
      sessionId: conversation.id,
      messageId: aiMessage.id,
    };

    res.json(response);
  } catch (error) {
    console.error("Chat endpoint error:", error);
    res.status(500).json({
      error: "An unexpected error occurred. Please try again.",
    });
  }
});

// GET /chat/history/:sessionId
router.get("/history/:sessionId", (req: Request, res: Response): void => {
  const { sessionId } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(sessionId)) {
    res.status(400).json({ error: "Invalid session ID format" });
    return;
  }

  try {
    const messages = getMessages(sessionId);
    const response: HistoryResponse = {
      sessionId,
      messages,
    };
    res.json(response);
  } catch (error) {
    console.error("History endpoint error:", error);
    res.status(500).json({ error: "Failed to retrieve conversation history" });
  }
});

// GET /chat/sessions - list recent sessions (for dev/debug)
router.get("/sessions", (_req: Request, res: Response): void => {
  try {
    const { db } = require("../db/database");
    const sessions = db
      .prepare("SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50")
      .all();
    res.json({ sessions });
  } catch (error) {
    console.error("Sessions endpoint error:", error);
    res.status(500).json({ error: "Failed to retrieve sessions" });
  }
});

export default router;
