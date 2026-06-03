const API_BASE = import.meta.env.VITE_API_URL || "";

export interface Message {
  id: string;
  conversation_id: string;
  sender: "user" | "ai";
  text: string;
  created_at: string;
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

export interface ApiError {
  error: string;
  details?: string[];
}

export async function sendMessage(
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId }),
  });

  if (!res.ok) {
    const err: ApiError = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error(err.details ? err.details.join(". ") : err.error);
  }

  return res.json();
}

export async function fetchHistory(sessionId: string): Promise<HistoryResponse> {
  const res = await fetch(`${API_BASE}/chat/history/${sessionId}`);

  if (!res.ok) {
    const err: ApiError = await res.json().catch(() => ({ error: "Failed to load history" }));
    throw new Error(err.error);
  }

  return res.json();
}

export function getStoredSessionId(): string | null {
  try {
    return localStorage.getItem("spur_session_id");
  } catch {
    return null;
  }
}

export function storeSessionId(sessionId: string): void {
  try {
    localStorage.setItem("spur_session_id", sessionId);
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem("spur_session_id");
  } catch {
    // Silently fail
  }
}
