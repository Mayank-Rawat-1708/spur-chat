<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    sendMessage,
    fetchHistory,
    getStoredSessionId,
    storeSessionId,
    clearStoredSession,
    type Message,
  } from "./lib/api";

  // ─── State ───────────────────────────────────────────────────────────
  let messages: (Message & { pending?: boolean; error?: boolean })[] = [];
  let inputValue = "";
  let sessionId: string | null = null;
  let isLoading = false;
  let isLoadingHistory = true;
  let errorBanner = "";
  let messagesEl: HTMLElement;
  let inputEl: HTMLTextAreaElement;
  let showWelcome = true;

  const QUICK_REPLIES = [
    "What's your return policy?",
    "Do you ship internationally?",
    "What payment methods do you accept?",
    "How do I track my order?",
  ];

  // ─── Lifecycle ───────────────────────────────────────────────────────
  onMount(async () => {
    const stored = getStoredSessionId();
    if (stored) {
      try {
        const history = await fetchHistory(stored);
        sessionId = history.sessionId;
        messages = history.messages;
        if (messages.length > 0) showWelcome = false;
      } catch {
        clearStoredSession();
      }
    }
    isLoadingHistory = false;
    await scrollToBottom();
  });

  // ─── Helpers ─────────────────────────────────────────────────────────
  async function scrollToBottom() {
    await tick();
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  function formatTime(isoString: string): string {
    const d = new Date(isoString + (isoString.endsWith("Z") ? "" : "Z"));
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function autoResize() {
    if (inputEl) {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
    }
  }

  async function submit() {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    errorBanner = "";
    showWelcome = false;
    inputValue = "";
    if (inputEl) {
      inputEl.style.height = "auto";
    }

    // Optimistic user message
    const optimisticId = `opt-${Date.now()}`;
    const userMsg: Message & { pending?: boolean } = {
      id: optimisticId,
      conversation_id: sessionId || "",
      sender: "user",
      text,
      created_at: new Date().toISOString(),
    };
    messages = [...messages, userMsg];

    // Pending AI message
    const pendingId = `pending-${Date.now()}`;
    const pendingMsg: Message & { pending?: boolean } = {
      id: pendingId,
      conversation_id: sessionId || "",
      sender: "ai",
      text: "",
      created_at: new Date().toISOString(),
      pending: true,
    };
    messages = [...messages, pendingMsg];

    isLoading = true;
    await scrollToBottom();

    try {
      const response = await sendMessage(text, sessionId || undefined);

      // Update session
      if (!sessionId) {
        sessionId = response.sessionId;
        storeSessionId(sessionId);
      }

      // Replace pending with real AI message
      messages = messages.map((m) => {
        if (m.id === pendingId) {
          return {
            id: response.messageId,
            conversation_id: sessionId!,
            sender: "ai" as const,
            text: response.reply,
            created_at: new Date().toISOString(),
          };
        }
        return m;
      });
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : "Something went wrong";
      // Replace pending with error message
      messages = messages.map((m) => {
        if (m.id === pendingId) {
          return {
            ...m,
            text: errorText,
            pending: false,
            error: true,
          };
        }
        return m;
      });
    } finally {
      isLoading = false;
      await scrollToBottom();
      inputEl?.focus();
    }
  }

  function useQuickReply(q: string) {
    inputValue = q;
    submit();
  }

  function startNewChat() {
    clearStoredSession();
    sessionId = null;
    messages = [];
    showWelcome = true;
    errorBanner = "";
    inputValue = "";
  }
</script>

<div class="app">
  <!-- Header -->
  <header class="header">
    <div class="header-inner">
      <div class="brand">
        <div class="brand-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="#0f172a"/>
            <path d="M7 14C7 10.134 10.134 7 14 7C17.866 7 21 10.134 21 14" stroke="#f97316" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="14" cy="18" r="3" fill="#f97316"/>
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-name">SpurStore</span>
          <span class="brand-status">
            <span class="status-dot"></span>
            Support · Online
          </span>
        </div>
      </div>
      <div class="header-actions">
        {#if messages.length > 0}
          <button class="btn-ghost" on:click={startNewChat} title="New conversation">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New chat
          </button>
        {/if}
      </div>
    </div>
  </header>

  <!-- Messages -->
  <main class="messages" bind:this={messagesEl}>
    {#if isLoadingHistory}
      <div class="loading-state">
        <div class="spinner"></div>
        <span>Loading conversation…</span>
      </div>
    {:else}
      {#if showWelcome}
        <div class="welcome">
          <div class="welcome-avatar">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="16" fill="#fff3eb"/>
              <path d="M10 16C10 12.686 12.686 10 16 10C19.314 10 22 12.686 22 16" stroke="#f97316" stroke-width="2" stroke-linecap="round"/>
              <circle cx="16" cy="20" r="3" fill="#f97316"/>
            </svg>
          </div>
          <h2 class="welcome-title">Hi, I'm Aria 👋</h2>
          <p class="welcome-sub">SpurStore's AI support agent. Ask me anything about orders, shipping, returns, or payments.</p>
          <div class="quick-replies">
            {#each QUICK_REPLIES as q}
              <button class="quick-reply" on:click={() => useQuickReply(q)}>
                {q}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#each messages as msg (msg.id)}
        <div class="message-row {msg.sender}" class:error={msg.error}>
          {#if msg.sender === "ai"}
            <div class="avatar">
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="16" fill="#fff3eb"/>
                <path d="M10 16C10 12.686 12.686 10 16 10C19.314 10 22 12.686 22 16" stroke="#f97316" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="16" cy="20" r="2.5" fill="#f97316"/>
              </svg>
            </div>
          {/if}
          <div class="bubble-wrap">
            <div class="bubble">
              {#if msg.pending}
                <span class="typing-indicator">
                  <span></span><span></span><span></span>
                </span>
              {:else}
                {msg.text}
              {/if}
            </div>
            {#if !msg.pending}
              <span class="timestamp">{formatTime(msg.created_at)}</span>
            {/if}
          </div>
        </div>
      {/each}

      {#if errorBanner}
        <div class="error-banner">{errorBanner}</div>
      {/if}
    {/if}
  </main>

  <!-- Input area -->
  <footer class="input-area">
    <div class="input-inner">
      <textarea
        bind:this={inputEl}
        bind:value={inputValue}
        on:keydown={handleKeydown}
        on:input={autoResize}
        placeholder="Type your message…"
        rows="1"
        maxlength="5000"
        disabled={isLoading || isLoadingHistory}
        aria-label="Chat message input"
      ></textarea>
      <button
        class="send-btn"
        on:click={submit}
        disabled={isLoading || !inputValue.trim() || isLoadingHistory}
        aria-label="Send message"
      >
        {#if isLoading}
          <svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        {:else}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        {/if}
      </button>
    </div>
    <p class="input-hint">Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line</p>
  </footer>
</div>

<style>
  /* ── Reset & Base ──────────────────────────────────────────────────── */
  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(html, body) {
    height: 100%;
    font-family: "DM Sans", system-ui, sans-serif;
    background: #f1f5f9;
    color: #0f172a;
    -webkit-font-smoothing: antialiased;
  }

  :global(#app) {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── App Shell ─────────────────────────────────────────────────────── */
  .app {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 720px;
    height: 100dvh;
    background: #fff;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.06), 0 8px 40px rgba(0,0,0,0.08);
    border-radius: 0;
    overflow: hidden;
  }

  @media (min-width: 768px) {
    :global(#app) {
      padding: 24px;
    }
    .app {
      height: calc(100dvh - 48px);
      border-radius: 20px;
    }
  }

  /* ── Header ────────────────────────────────────────────────────────── */
  .header {
    background: #fff;
    border-bottom: 1px solid #e2e8f0;
    padding: 0 20px;
    flex-shrink: 0;
  }

  .header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 64px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand-logo {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .brand-name {
    font-size: 15px;
    font-weight: 600;
    color: #0f172a;
    letter-spacing: -0.01em;
  }

  .brand-status {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: #64748b;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    background: #22c55e;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-ghost {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: transparent;
    color: #64748b;
    font-size: 13px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-ghost:hover {
    background: #f8fafc;
    color: #0f172a;
    border-color: #cbd5e1;
  }

  /* ── Messages Area ─────────────────────────────────────────────────── */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    scroll-behavior: smooth;
  }

  .messages::-webkit-scrollbar {
    width: 4px;
  }

  .messages::-webkit-scrollbar-track {
    background: transparent;
  }

  .messages::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 99px;
  }

  /* ── Loading State ─────────────────────────────────────────────────── */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 12px;
    color: #94a3b8;
    font-size: 14px;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid #e2e8f0;
    border-top-color: #f97316;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Welcome Screen ────────────────────────────────────────────────── */
  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 32px 16px 16px;
    gap: 12px;
    animation: fadeUp 0.4s ease both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .welcome-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #fff3eb;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #fed7aa;
    margin-bottom: 4px;
  }

  .welcome-title {
    font-size: 22px;
    font-weight: 600;
    color: #0f172a;
    letter-spacing: -0.03em;
  }

  .welcome-sub {
    font-size: 14px;
    color: #64748b;
    line-height: 1.5;
    max-width: 340px;
  }

  .quick-replies {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 8px;
    max-width: 480px;
  }

  .quick-reply {
    padding: 8px 14px;
    border: 1.5px solid #e2e8f0;
    border-radius: 99px;
    background: #f8fafc;
    color: #374151;
    font-size: 13px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
  }

  .quick-reply:hover {
    background: #fff3eb;
    border-color: #f97316;
    color: #c2410c;
  }

  /* ── Message Rows ──────────────────────────────────────────────────── */
  .message-row {
    display: flex;
    gap: 10px;
    animation: msgIn 0.25s ease both;
    align-items: flex-end;
  }

  @keyframes msgIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .message-row.user {
    flex-direction: row-reverse;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    flex-shrink: 0;
    overflow: hidden;
  }

  .bubble-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: min(75%, 480px);
  }

  .message-row.user .bubble-wrap {
    align-items: flex-end;
  }

  .message-row.ai .bubble-wrap {
    align-items: flex-start;
  }

  .bubble {
    padding: 11px 15px;
    border-radius: 18px;
    font-size: 14.5px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .message-row.user .bubble {
    background: #0f172a;
    color: #f8fafc;
    border-bottom-right-radius: 4px;
  }

  .message-row.ai .bubble {
    background: #f1f5f9;
    color: #1e293b;
    border-bottom-left-radius: 4px;
  }

  .message-row.error .bubble {
    background: #fff1f2;
    color: #be123c;
    border: 1px solid #fecdd3;
  }

  .timestamp {
    font-size: 11px;
    color: #94a3b8;
    font-family: "DM Mono", monospace;
    padding: 0 4px;
  }

  /* ── Typing Indicator ──────────────────────────────────────────────── */
  .typing-indicator {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 2px 0;
  }

  .typing-indicator span {
    width: 7px;
    height: 7px;
    background: #94a3b8;
    border-radius: 50%;
    animation: bounce 1.2s infinite;
  }

  .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-5px); }
  }

  /* ── Error Banner ──────────────────────────────────────────────────── */
  .error-banner {
    background: #fff1f2;
    border: 1px solid #fecdd3;
    color: #be123c;
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 13.5px;
    text-align: center;
  }

  /* ── Input Area ────────────────────────────────────────────────────── */
  .input-area {
    padding: 12px 16px 14px;
    border-top: 1px solid #e2e8f0;
    background: #fff;
    flex-shrink: 0;
  }

  .input-inner {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    background: #f8fafc;
    border: 1.5px solid #e2e8f0;
    border-radius: 14px;
    padding: 8px 8px 8px 14px;
    transition: border-color 0.15s;
  }

  .input-inner:focus-within {
    border-color: #f97316;
    background: #fff;
  }

  textarea {
    flex: 1;
    border: none;
    background: transparent;
    resize: none;
    font-family: "DM Sans", system-ui, sans-serif;
    font-size: 14.5px;
    line-height: 1.5;
    color: #0f172a;
    outline: none;
    min-height: 24px;
    max-height: 120px;
    overflow-y: auto;
  }

  textarea::placeholder {
    color: #94a3b8;
  }

  textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .send-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    background: #f97316;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
  }

  .send-btn:hover:not(:disabled) {
    background: #ea6c0a;
    transform: scale(1.04);
  }

  .send-btn:disabled {
    background: #e2e8f0;
    color: #94a3b8;
    cursor: not-allowed;
    transform: none;
  }

  .spin {
    animation: spin 0.7s linear infinite;
  }

  .input-hint {
    margin-top: 8px;
    font-size: 11.5px;
    color: #94a3b8;
    text-align: center;
  }

  kbd {
    font-family: "DM Mono", monospace;
    font-size: 10.5px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    padding: 1px 4px;
    border-radius: 4px;
    color: #64748b;
  }
</style>
