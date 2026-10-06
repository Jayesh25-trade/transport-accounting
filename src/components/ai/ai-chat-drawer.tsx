"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Bot,
  User,
  AlertCircle,
  MessageSquare,
  Paperclip,
  LayoutGrid,
  Plus,
  Play,
  FilePlus,
  BookPlus,
  CreditCard,
  Receipt,
  Upload,
  ChevronDown,
} from "lucide-react";
import { useFirm } from "@/lib/firm-context";
import { cn } from "@/lib/utils";
import { AiActionGrid, AIActionType } from "./ai-action-grid";
import { VoiceInput } from "./voice-input";
import {
  DailyBookFormCard,
  CreateBillFormCard,
  PaymentFormCard,
  DriverVoucherFormCard,
  DocumentUploadCard,
} from "./ai-forms";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  status?: "sending" | "sent" | "error";
  errorText?: string;
}

/**
 * Helper to parse natural language prompts into prefilled form fields.
 */
function parsePrefillFromPrompt(prompt: string): { action: AIActionType | null; prefill: Record<string, any> } {
  const q = prompt.toLowerCase();
  const prefill: Record<string, any> = {};

  // Extract truck number
  const truckMatch = prompt.match(/\b([A-Z]{2}\s?\d{2}\s?[A-Z]{1,2}\s?\d{4})\b/i);
  if (truckMatch) prefill.truckNumberRaw = truckMatch[1].toUpperCase();

  // Extract route locations: "from X to Y"
  const routeMatch = prompt.match(/from\s+([A-Za-z0-9\s]+?)\s+to\s+([A-Za-z0-9\s]+?)(?:,|\.|$|weight|rate|n weight|r weight)/i);
  if (routeMatch) {
    prefill.fromLocationRaw = routeMatch[1].trim();
    prefill.toLocationRaw = routeMatch[2].trim();
  }

  // Extract N-weight and R-weight
  const nWeightMatch = prompt.match(/n\s*weight\s*(\d+(?:\.\d+)?)/i);
  if (nWeightMatch) prefill.nWeight = nWeightMatch[1];

  const rWeightMatch = prompt.match(/r\s*weight\s*(\d+(?:\.\d+)?)/i);
  if (rWeightMatch) prefill.rWeight = rWeightMatch[1];

  // Extract Customer Rate and Driver Rate
  const custRateMatch = prompt.match(/customer\s*rate\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)/i);
  if (custRateMatch) prefill.customerRate = custRateMatch[1];

  const driverRateMatch = prompt.match(/(?:driver\s*rate|rate)\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)/i);
  if (driverRateMatch) prefill.rate = driverRateMatch[1];

  // Extract amount
  const amountMatch = prompt.match(/(?:amount|payment|advance|cash)\s*(?:of|is)?\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)/i);
  if (amountMatch) prefill.amount = amountMatch[1];

  // Determine intent / form action
  if (/daily book|daily entry|add trip|truck|lr\s*no|n weight|r weight/i.test(q)) {
    return { action: "ADD_DAILY_BOOK", prefill };
  }
  if (/create bill|make bill|generate bill|bill banana/i.test(q)) {
    return { action: "CREATE_BILL", prefill };
  }
  if (/record payment|add payment|payment received|jama/i.test(q)) {
    return { action: "RECORD_PAYMENT", prefill };
  }
  if (/driver voucher|driver advance|diesel expense|driver cash/i.test(q)) {
    return { action: "ADD_DRIVER_VOUCHER", prefill };
  }

  return { action: null, prefill: {} };
}

/**
 * Detect context from assistant message and provide start action button.
 */
function getMessageActionButtons(content: string): { label: string; action: AIActionType; color: string }[] {
  const q = content.toLowerCase();
  const buttons: { label: string; action: AIActionType; color: string }[] = [];

  if (/create bill|bill add|bill form|bill banana|bill/i.test(q)) {
    buttons.push({
      label: "🚀 Start Create Bill Form",
      action: "CREATE_BILL",
      color: "bg-emerald-600 text-white hover:bg-emerald-700",
    });
  }
  if (/daily book|daily entry|trip/i.test(q)) {
    buttons.push({
      label: "📘 Start Daily Book Form",
      action: "ADD_DAILY_BOOK",
      color: "bg-[#E05638] text-white hover:bg-[#c9492e]",
    });
  }
  if (/payment|receipt|jama/i.test(q)) {
    buttons.push({
      label: "💳 Start Record Payment Form",
      action: "RECORD_PAYMENT",
      color: "bg-purple-600 text-white hover:bg-purple-700",
    });
  }
  if (/driver voucher|diesel|advance/i.test(q)) {
    buttons.push({
      label: "🚚 Start Driver Voucher Form",
      action: "ADD_DRIVER_VOUCHER",
      color: "bg-amber-600 text-white hover:bg-amber-700",
    });
  }

  return buttons;
}

/**
 * Safe inline text renderer (renders **bold** without dangerouslySetInnerHTML).
 */
function FormattedInline({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={idx} className="font-semibold text-[#1A1D20]">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}

/**
 * Safe markdown block renderer (bullet lists, numbered lists, paragraphs).
 */
function FormattedMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushList = () => {
    if (!currentList) return;
    const ListTag = currentList.type;
    const isUl = currentList.type === "ul";
    elements.push(
      <ListTag
        key={`list-${elements.length}`}
        className={cn(
          "my-1.5 space-y-1 text-xs md:text-sm leading-relaxed",
          isUl ? "list-disc pl-5" : "list-decimal pl-5"
        )}
      >
        {currentList.items.map((item, i) => (
          <li key={i}>
            <FormattedInline text={item} />
          </li>
        ))}
      </ListTag>
    );
    currentList = null;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      elements.push(<div key={`empty-${index}`} className="h-1.5" />);
      return;
    }

    const bulletMatch = trimmed.match(/^[*•-]\s+(.+)$/);
    if (bulletMatch) {
      if (currentList && currentList.type !== "ul") flushList();
      if (!currentList) currentList = { type: "ul", items: [] };
      currentList.items.push(bulletMatch[1]);
      return;
    }

    const numMatch = trimmed.match(/^\d+[\.\)]\s+(.+)$/);
    if (numMatch) {
      if (currentList && currentList.type !== "ol") flushList();
      if (!currentList) currentList = { type: "ol", items: [] };
      currentList.items.push(numMatch[1]);
      return;
    }

    flushList();
    elements.push(
      <p key={`p-${index}`} className="my-1 text-xs md:text-sm leading-relaxed">
        <FormattedInline text={trimmed} />
      </p>
    );
  });

  flushList();

  return <div className="space-y-0.5">{elements}</div>;
}

export function AiChatDrawer() {
  const { currentFirm } = useFirm();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeForm, setActiveForm] = useState<AIActionType | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any>>({});
  const [showFullMenuGrid, setShowFullMenuGrid] = useState(false);
  const [showStartDropdown, setShowStartDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, activeForm, showFullMenuGrid, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const sendMessage = async (userPrompt?: string) => {
    const promptToSend = (userPrompt || input).trim();
    if (!promptToSend || isLoading) return;

    if (!currentFirm?.id) {
      const noFirmError: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        role: "assistant",
        content: "Please select an active firm before asking a question.",
        timestamp: new Date(),
        status: "error",
        errorText: "No firm selected",
      };
      setMessages((prev) => [...prev, noFirmError]);
      return;
    }

    const userMessageId = `user-${Date.now()}`;
    const newUserMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: promptToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    if (!userPrompt) setInput("");
    setIsLoading(true);
    setShowFullMenuGrid(false);

    // Parse prefill intent from user text
    const { action: detectedAction, prefill } = parsePrefillFromPrompt(promptToSend);
    if (detectedAction) {
      setActiveForm(detectedAction);
      setFormInitialValues(prefill);
    }

    const historyPayload = messages
      .filter((m) => !m.errorText)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-firm-id": currentFirm.id,
        },
        body: JSON.stringify({
          message: promptToSend,
          history: historyPayload,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        let errorMsg = "AI is temporarily unavailable. Please try again.";
        if (response.status === 429) {
          errorMsg = "You're sending requests too quickly. Please wait a moment and try again.";
        } else if (response.status === 401) {
          errorMsg = "Your session has expired. Please log in again.";
        } else if (response.status === 403) {
          errorMsg = "You don't have access to this firm.";
        } else if (data?.error?.message) {
          errorMsg = data.error.message;
        }

        const errorMessage: ChatMessage = {
          id: `ai-err-${Date.now()}`,
          role: "assistant",
          content: errorMsg,
          timestamp: new Date(),
          status: "error",
          errorText: errorMsg,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } else {
        const aiResponse: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: data.data.answer,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiResponse]);
      }
    } catch {
      const networkErrorMessage: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        role: "assistant",
        content: "Something went wrong. Please check your network connection and try again.",
        timestamp: new Date(),
        status: "error",
        errorText: "Network error",
      };
      setMessages((prev) => [...prev, networkErrorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionSelect = (actionId: AIActionType, prompt?: string) => {
    setShowFullMenuGrid(false);
    setShowStartDropdown(false);

    if (prompt) {
      sendMessage(prompt);
      return;
    }

    if (
      actionId === "ADD_DAILY_BOOK" ||
      actionId === "CREATE_BILL" ||
      actionId === "RECORD_PAYMENT" ||
      actionId === "ADD_DRIVER_VOUCHER" ||
      actionId === "UPLOAD_DOCUMENT"
    ) {
      setActiveForm(actionId);
      setFormInitialValues({});
    }
  };

  const handleFormComplete = (summaryMessage: string) => {
    const assistantMessage: ChatMessage = {
      id: `ai-form-${Date.now()}`,
      role: "assistant",
      content: summaryMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);
    setActiveForm(null);
    setFormInitialValues({});
  };

  const handleVoiceTranscript = (text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ── Floating Entry Point Button ────────────────────────────────────── */}
      <button
        type="button"
        id="ai-assistant-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full px-4 py-2.5 shadow-lg transition-all duration-200 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#E05638] focus:ring-offset-2",
          isOpen
            ? "bg-[#1A1D20] text-white"
            : "bg-[#E05638] text-white hover:bg-[#c9492e]"
        )}
        aria-label="Toggle AI Assistant"
      >
        <Sparkles size={18} className={cn("shrink-0", isLoading && "animate-spin")} />
        <span className="font-display text-xs font-bold tracking-wide">
          {isOpen ? "Close AI" : "AI Assistant"}
        </span>
      </button>

      {/* ── Chat Panel / Drawer ────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-50 flex flex-col bg-white border border-[#D8D5CE] shadow-2xl transition-all duration-200 ease-in-out",
            "bottom-5 right-5 w-[460px] h-[680px] max-h-[calc(100vh-2rem)] rounded-2xl overflow-hidden",
            "max-sm:inset-x-2 max-sm:bottom-2 max-sm:top-14 max-sm:w-auto max-sm:h-auto max-sm:rounded-xl"
          )}
        >
          {/* Header Controls */}
          <div className="flex items-center justify-between border-b border-[#D8D5CE] bg-[#FAF8F5] px-3.5 py-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-xl bg-[#E05638] text-white shadow-xs">
                <Bot size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display text-xs font-bold text-[#1A1D20]">
                    Transport AI
                  </h3>
                  <span className="rounded-full bg-[#EFECE6] border border-[#D8D5CE] px-1.5 py-0.5 text-[9px] font-semibold text-[#5F6368]">
                    Live
                  </span>
                </div>
                <p
                  className="text-[10px] text-[#7A7F85] truncate max-w-[130px]"
                  title={currentFirm?.name || "Active Firm"}
                >
                  {currentFirm?.name || "Active Firm"}
                </p>
              </div>
            </div>

            {/* HEADER CONTROLS: 1. START FROM STAT BUTTON & 2. ALL MENU BUTTON */}
            <div className="flex items-center gap-1.5 relative">
              {/* BUTTON 1: START ACTION BUTTON (START FROM STAT) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowStartDropdown((v) => !v)}
                  className="flex items-center gap-1 rounded-lg bg-[#E05638] px-2.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#c9492e] transition-colors"
                  title="Start any form action directly"
                >
                  <Plus size={14} />
                  <span>Start Action</span>
                  <ChevronDown size={13} />
                </button>

                {showStartDropdown && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-[#D8D5CE] bg-white p-1.5 shadow-xl z-50 text-xs space-y-0.5 animate-fade-in">
                    <div className="px-2 py-1 text-[10px] font-bold text-[#7A7F85] uppercase border-b border-[#EFECE6]">
                      Start Form Action
                    </div>
                    <button
                      onClick={() => handleActionSelect("CREATE_BILL")}
                      className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-emerald-50 text-emerald-700 font-bold"
                    >
                      <FilePlus size={14} /> Create Bill
                    </button>
                    <button
                      onClick={() => handleActionSelect("ADD_DAILY_BOOK")}
                      className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-red-50 text-[#E05638] font-bold"
                    >
                      <BookPlus size={14} /> Add Daily Book
                    </button>
                    <button
                      onClick={() => handleActionSelect("RECORD_PAYMENT")}
                      className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-purple-50 text-purple-700 font-bold"
                    >
                      <CreditCard size={14} /> Record Payment
                    </button>
                    <button
                      onClick={() => handleActionSelect("ADD_DRIVER_VOUCHER")}
                      className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-amber-50 text-amber-700 font-bold"
                    >
                      <Receipt size={14} /> Driver Voucher
                    </button>
                    <button
                      onClick={() => handleActionSelect("UPLOAD_DOCUMENT")}
                      className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 text-[#1A1D20] font-semibold"
                    >
                      <Upload size={14} /> Upload PDF / Image
                    </button>
                  </div>
                )}
              </div>

              {/* BUTTON 2: ALL MENU BUTTON (WHERE ALL MENU WILL COME WHICH WAS AT STRAIGHT) */}
              <button
                type="button"
                onClick={() => setShowFullMenuGrid((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all",
                  showFullMenuGrid
                    ? "border-[#E05638] bg-[#FDF2F0] text-[#E05638]"
                    : "border-[#D8D5CE] bg-white text-[#1A1D20] hover:bg-[#FAF8F5]"
                )}
                title="Open All Actions Menu"
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">All Menu</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-[#7A7F85] hover:bg-[#EFECE6] hover:text-[#1A1D20] transition-colors"
                aria-label="Close Assistant"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Conversation & Action Grid Area */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-[#FAF8F5]/30">
            {/* If user clicks ALL MENU button, show the complete Action Grid directly */}
            {showFullMenuGrid ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-[#FDF2F0] p-2 rounded-xl border border-[#E05638]/30">
                  <span className="font-bold text-xs text-[#E05638] flex items-center gap-1.5">
                    <LayoutGrid size={15} /> ALL ACTIONS MENU
                  </span>
                  <button
                    onClick={() => setShowFullMenuGrid(false)}
                    className="text-xs font-semibold text-[#7A7F85] hover:text-[#1A1D20]"
                  >
                    Hide Menu
                  </button>
                </div>
                <AiActionGrid onSelectAction={handleActionSelect} />
              </div>
            ) : messages.length === 0 && !activeForm ? (
              /* Structured Empty State Dashboard */
              <AiActionGrid onSelectAction={handleActionSelect} />
            ) : (
              /* Message History */
              messages.map((msg) => {
                const isUser = msg.role === "user";
                const msgActionButtons = !isUser ? getMessageActionButtons(msg.content) : [];

                return (
                  <div key={msg.id} className="space-y-1.5">
                    <div
                      className={cn(
                        "flex gap-2.5 max-w-[90%]",
                        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                      )}
                    >
                      <div
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-lg text-xs font-bold",
                          isUser
                            ? "bg-[#1A1D20] text-white"
                            : "bg-[#E05638] text-white"
                        )}
                      >
                        {isUser ? <User size={13} /> : <Bot size={13} />}
                      </div>

                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2.5 text-xs md:text-sm shadow-xs",
                          isUser
                            ? "bg-[#E05638] text-white rounded-tr-xs"
                            : msg.status === "error"
                            ? "bg-red-50 border border-red-200 text-red-700 rounded-tl-xs"
                            : "bg-white border border-[#D8D5CE] text-[#1A1D20] rounded-tl-xs"
                        )}
                      >
                        {msg.status === "error" ? (
                          <div className="flex items-start gap-2">
                            <AlertCircle size={15} className="shrink-0 text-red-500 mt-0.5" />
                            <div>
                              <p className="font-semibold text-red-800">Error</p>
                              <p className="mt-0.5 text-xs text-red-600">{msg.content}</p>
                            </div>
                          </div>
                        ) : isUser ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        ) : (
                          <FormattedMessage content={msg.content} />
                        )}

                        <span
                          className={cn(
                            "mt-1 block text-[10px] text-right opacity-70",
                            isUser ? "text-white/80" : "text-[#7A7F85]"
                          )}
                        >
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* CONTEXTUAL START ACTION BUTTONS RIGHT IN MESSAGE RESPONSE */}
                    {!isUser && msgActionButtons.length > 0 && (
                      <div className="pl-8 flex flex-wrap gap-1.5 animate-fade-in">
                        {msgActionButtons.map((btn, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleActionSelect(btn.action)}
                            className={cn(
                              "rounded-lg px-3 py-1.5 text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95",
                              btn.color
                            )}
                          >
                            <span>{btn.label}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => setShowFullMenuGrid(true)}
                          className="rounded-lg border border-[#D8D5CE] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#5F6368] hover:bg-[#FAF8F5] flex items-center gap-1"
                        >
                          <LayoutGrid size={13} />
                          <span>All Menu</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Active Contextual Form Card rendering inside conversation */}
            {activeForm === "ADD_DAILY_BOOK" && (
              <DailyBookFormCard
                initialValues={formInitialValues}
                onCancel={() => setActiveForm(null)}
                onComplete={handleFormComplete}
              />
            )}
            {activeForm === "CREATE_BILL" && (
              <CreateBillFormCard
                initialValues={formInitialValues}
                onCancel={() => setActiveForm(null)}
                onComplete={handleFormComplete}
              />
            )}
            {activeForm === "RECORD_PAYMENT" && (
              <PaymentFormCard
                initialValues={formInitialValues}
                onCancel={() => setActiveForm(null)}
                onComplete={handleFormComplete}
              />
            )}
            {activeForm === "ADD_DRIVER_VOUCHER" && (
              <DriverVoucherFormCard
                initialValues={formInitialValues}
                onCancel={() => setActiveForm(null)}
                onComplete={handleFormComplete}
              />
            )}
            {activeForm === "UPLOAD_DOCUMENT" && (
              <DocumentUploadCard
                initialValues={formInitialValues}
                onCancel={() => setActiveForm(null)}
                onComplete={handleFormComplete}
              />
            )}

            {/* Loading Thinking Indicator */}
            {isLoading && (
              <div className="flex gap-2.5 mr-auto max-w-[85%]">
                <div className="grid size-6 shrink-0 place-items-center rounded-lg bg-[#E05638] text-white">
                  <Bot size={13} />
                </div>
                <div className="rounded-2xl rounded-tl-xs bg-white border border-[#D8D5CE] px-4 py-3 text-xs text-[#7A7F85] flex items-center gap-2 shadow-xs">
                  <Loader2 size={14} className="animate-spin text-[#E05638]" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input & Media Controls */}
          <div className="border-t border-[#D8D5CE] bg-white p-3 shrink-0">
            <div className="relative flex items-center gap-1.5">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything or speak..."
                disabled={isLoading}
                className="w-full resize-none rounded-xl border border-[#D8D5CE] bg-[#FAF8F5] py-2.5 pl-3 pr-20 text-xs md:text-sm text-[#1A1D20] placeholder-[#7A7F85] focus:border-[#E05638] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#E05638] disabled:opacity-50"
              />

              <div className="absolute right-2.5 flex items-center gap-1">
                {/* All Menu Quick Toggle Button in Footer */}
                <button
                  type="button"
                  onClick={() => setShowFullMenuGrid((v) => !v)}
                  disabled={isLoading}
                  title="Toggle All Actions Menu"
                  className={cn(
                    "grid size-7 place-items-center rounded-lg border transition-colors",
                    showFullMenuGrid
                      ? "bg-[#FDF2F0] border-[#E05638] text-[#E05638]"
                      : "bg-[#EFECE6] border-transparent text-[#5F6368] hover:bg-[#D8D5CE] hover:text-[#1A1D20]"
                  )}
                >
                  <LayoutGrid size={14} />
                </button>

                {/* Voice Microphone Input */}
                <VoiceInput onTranscript={handleVoiceTranscript} disabled={isLoading} />

                {/* Quick Document Upload Trigger */}
                <button
                  type="button"
                  onClick={() => handleActionSelect("UPLOAD_DOCUMENT")}
                  disabled={isLoading}
                  title="Upload Bill / Document"
                  className="grid size-7 place-items-center rounded-lg bg-[#EFECE6] text-[#5F6368] hover:bg-[#D8D5CE] hover:text-[#1A1D20] transition-colors"
                >
                  <Paperclip size={14} />
                </button>

                {/* Send Button */}
                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="grid size-7 place-items-center rounded-lg bg-[#E05638] text-white transition-all hover:bg-[#c9492e] disabled:bg-[#D8D5CE] disabled:text-white/60"
                  aria-label="Send message"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#7A7F85] px-1">
              <span>Shift + Enter for new line</span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                Live Accounts Connected
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
