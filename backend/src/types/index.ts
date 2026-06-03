export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  metadata?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: "user" | "ai";
  text: string;
  created_at: string;
  metadata?: string;
}

export interface FAQKnowledge {
  id: number;
  category: string;
  question: string;
  answer: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  reply: string;
  sessionId: string;
  messageId: string;
}

export interface HistoryResponse {
  sessionId: string;
  messages: Message[];
}

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}
