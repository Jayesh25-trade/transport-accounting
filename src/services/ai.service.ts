/**
 * ai.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * AI assistant service for the Transport Accounting application.
 *
 * RULES (NEVER CHANGE):
 *  • This service is READ-ONLY. It queries data and generates answers.
 *  • It NEVER modifies bills, payments, entries, parties, or any stored data.
 *  • It NEVER returns the Groq API key or any other secret.
 *  • Context data is assembled entirely from existing service functions.
 *  • All numbers come from the database — no calculations are performed here.
 *  • The model is always explicitly told not to calculate or invent any values.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { getGroqClient, AI_MODEL, AI_MAX_TOKENS, AI_TEMPERATURE } from "@/lib/ai-client";
import { getDashboardOverview } from "@/services/dashboard.service";
import { getOutstandingReport, getAgingReport } from "@/services/report.service";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIChatRequest {
  message: string;
  history?: ChatMessage[];
  firmId: string;
  firmName?: string;
}

export interface AIChatResponse {
  answer: string;
  modelUsed: string;
  tokensUsed?: number;
  intent: AIIntent;
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent classification (F2 — context routing)
// ─────────────────────────────────────────────────────────────────────────────

export type AIIntent =
  | "outstanding"
  | "aging"
  | "billing"
  | "payments"
  | "daily_book"
  | "driver_vouchers"
  | "general";

/**
 * Classifies the user's question into a narrow intent so only the relevant
 * data section is fetched from the database, rather than the entire firm snapshot.
 *
 * This is keyword-based (fast, deterministic, zero API calls).
 * A model-based classifier can replace this in a future phase.
 */
export function classifyIntent(message: string): AIIntent {
  const q = message.toLowerCase();

  // 1. Driver Vouchers (specific driver expenses/advances)
  if (/driver|voucher|diesel|fuel|hamali|\bac\b/.test(q))
    return "driver_vouchers";

  // 2. Aging / overdue (time-based debt buckets)
  if (/aging|ageing|overdue|how old|how long.*due|bucket|days.*old|\b(30|60|90|180)\s*days?/.test(q))
    return "aging";

  // 3. Daily book / trips / consignments
  if (/daily book|daily entry|entries|consignment|\btrip|dispatch|loaded|unloaded/.test(q))
    return "daily_book";

  // 4. Payments / receipts / advances
  if (/payment|receipt|advance|received|\bpaid\b|collection|neft|rtgs|cheque|cash received/.test(q))
    return "payments";

  // 5. Outstanding / receivables / balances
  if (/outstanding|\bdue\b|unpaid|pending|receivable|balance|how much.*owe|collect/.test(q))
    return "outstanding";

  // 6. Billing / freight / invoices
  if (/bill|invoice|freight|tds|shortage|debit note|\blr\b|lorry receipt|gross|net payable/.test(q))
    return "billing";

  // Fallback: general questions get a reduced combined summary
  return "general";
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt (F3 + F6 — strengthened guardrails & multi-lingual support)
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(firmName: string): string {
  return `You are a read-only transport accounting assistant for the firm "${firmName}".
You receive a JSON snapshot of the firm's live financial data with each question.
All amounts are in Indian Rupees (₹). Use Indian number formatting (e.g. ₹1,95,200 or "1.95 lakh") where appropriate.

LANGUAGE & CONVERSATIONAL STYLE REQUIREMENT:
- Reply in the EXACT SAME LANGUAGE and communication style as the user's message (Hindi, Hinglish, English, Marathi, etc.).
- Example (Hinglish): "mujhe ek bill add karna hai" -> "Bilkul! Bill create karne ke liye main aapke liye Bill Form open kar deta hoon. Pehle Billing Party select karenge aur unki received trips bill mein include karenge."
- Example (Hindi): "बिल कैसे बनाएं?" -> "बिल बनाने के लिए आप Create Bill फ़ॉर्म का उपयोग कर सकते हैं।"
- For general greetings ("Hi", "Hello") or help questions ("Bill kaise add karu?", "Outstanding check kaise kare?"), give a helpful, courteous response in the user's language explaining how to perform the action or navigate the application.

STRICT RULES — FOLLOW EVERY ONE WITHOUT EXCEPTION:
1. Answer ONLY using values that are explicitly present in the data context provided for data queries. Never use information from your training data about this firm.
2. Do NOT invent, estimate, or hallucinate any financial value — not amounts, not dates, not bill numbers, not party names.
3. Do NOT invent or imply the existence of any party, bill, payment, or transaction unless it appears in the provided data.
4. Do NOT claim that any transaction occurred, was created, or was modified unless the data explicitly shows it.
5. Do NOT perform accounting calculations independently. Never add, subtract, multiply, or derive figures not already present as a field in the data. Report only numbers that appear in the data as-is.
6. Do NOT suggest, initiate, or describe any direct backend database write operations. When user wants to create an entry, guide them through the contextual form preview & confirmation workflow.
7. If the data context does not contain sufficient information to answer a financial data question, clearly state: "The data provided does not include enough information to answer this question."
8. Use standard Indian transport accounting terminology: Bill, LR (Lorry Receipt), Party, Freight, Shortage Debit, TDS, Advance, Net Payable, Outstanding, Aging, Driver Voucher.
9. Keep answers concise and professional. Use bullet points or structured formatting where helpful.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context assembler — intent-routed (F2)
// ─────────────────────────────────────────────────────────────────────────────

async function assembleFirmContext(
  db: NodePgDatabase<any>,
  firmId: string,
  intent: AIIntent
): Promise<string> {
  try {
    switch (intent) {
      // ── Outstanding only ────────────────────────────────────────────────────
      case "outstanding": {
        const outstanding = await getOutstandingReport(db, firmId);
        return JSON.stringify({
          asOf: new Date().toISOString().split("T")[0],
          outstanding: {
            totalOutstanding: outstanding.summary.totalOutstanding,
            pendingBills: outstanding.summary.totalPendingBills,
            partiallyPaidBills: outstanding.summary.totalPartiallyPaidBills,
            paidBills: outstanding.summary.totalPaidBills,
            totalBills: outstanding.summary.totalBillsCount,
            unallocatedAdvances: outstanding.summary.totalUnallocatedAdvances,
            topOutstanding: outstanding.bills
              .filter((b) => b.pendingAmount > 0)
              .sort((a, b) => b.pendingAmount - a.pendingAmount)
              .slice(0, 15)
              .map((b) => ({
                billNumber: b.billNumber,
                date: b.billDate,
                party: b.partyName,
                netBill: b.netBillAmount,
                received: b.receivedAmount,
                pending: b.pendingAmount,
                status: b.status,
              })),
          },
        }, null, 2);
      }

      // ── Aging only ──────────────────────────────────────────────────────────
      case "aging": {
        const aging = await getAgingReport(db, firmId);
        return JSON.stringify({
          asOf: aging.asOfDate,
          aging: {
            totalOutstanding: aging.summary.totalOutstanding,
            buckets: {
              current: aging.summary.current,
              "1-30days": aging.summary.days1_30,
              "31-60days": aging.summary.days31_60,
              "61-90days": aging.summary.days61_90,
              "91-180days": aging.summary.days91_180,
              "181+days": aging.summary.days181Plus,
            },
            partyBreakdown: aging.partyBreakdown
              .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
              .slice(0, 15),
          },
        }, null, 2);
      }

      // ── Billing only ────────────────────────────────────────────────────────
      case "billing": {
        const overview = await getDashboardOverview(db, firmId);
        return JSON.stringify({
          asOf: new Date().toISOString().split("T")[0],
          billing: {
            totalBills: overview.billing.billCount,
            grossFreight: overview.billing.grossFreightTotal,
            shortageDebits: overview.billing.shortageDebitTotal,
            tdsDeductions: overview.billing.tdsTotal,
            netPayable: overview.billing.netPayableTotal,
            recentBills: overview.billing.recentBills.map((b) => ({
              billNumber: b.billNumber,
              date: b.billDate,
              party: b.partyName,
              netAmount: b.netBillAmount,
              status: b.status,
            })),
          },
        }, null, 2);
      }

      // ── Payments only ───────────────────────────────────────────────────────
      case "payments": {
        const overview = await getDashboardOverview(db, firmId);
        return JSON.stringify({
          asOf: new Date().toISOString().split("T")[0],
          payments: {
            totalPayments: overview.payments.paymentCount,
            totalReceived: overview.payments.totalReceipts,
            againstBills: overview.payments.againstBillTotal,
            advances: overview.payments.advanceTotal,
            recentPayments: overview.payments.recentPayments.map((p) => ({
              date: p.paymentDate,
              party: p.partyName,
              amount: p.amount,
              mode: p.paymentMode,
              type: p.paymentType,
              ref: p.referenceNumber,
            })),
          },
        }, null, 2);
      }

      // ── Daily book only ─────────────────────────────────────────────────────
      case "daily_book": {
        const overview = await getDashboardOverview(db, firmId);
        return JSON.stringify({
          asOf: new Date().toISOString().split("T")[0],
          dailyBook: {
            totalEntries: overview.dailyBook.totalEntries,
            received: overview.dailyBook.receivedCount,
            pending: overview.dailyBook.pendingCount,
          },
        }, null, 2);
      }

      // ── Driver vouchers only ────────────────────────────────────────────────
      case "driver_vouchers": {
        const overview = await getDashboardOverview(db, firmId);
        return JSON.stringify({
          asOf: new Date().toISOString().split("T")[0],
          driverVouchers: {
            total: overview.driverVouchers.totalVouchers,
            advance: overview.driverVouchers.totalAdvance,
            cash: overview.driverVouchers.totalCash,
            diesel: overview.driverVouchers.totalDiesel,
            ac: overview.driverVouchers.totalAc,
            otherExpense: overview.driverVouchers.totalExpense,
          },
        }, null, 2);
      }

      // ── General / unknown — send a reduced combined summary ─────────────────
      default: {
        const [overview, outstanding] = await Promise.all([
          getDashboardOverview(db, firmId),
          getOutstandingReport(db, firmId),
        ]);
        return JSON.stringify({
          asOf: new Date().toISOString().split("T")[0],
          summary: {
            billing: {
              totalBills: overview.billing.billCount,
              grossFreight: overview.billing.grossFreightTotal,
              shortageDebits: overview.billing.shortageDebitTotal,
              tdsDeductions: overview.billing.tdsTotal,
              netPayable: overview.billing.netPayableTotal,
            },
            payments: {
              totalReceived: overview.payments.totalReceipts,
              advances: overview.payments.advanceTotal,
            },
            outstanding: {
              totalOutstanding: outstanding.summary.totalOutstanding,
              pendingBills: outstanding.summary.totalPendingBills,
              unallocatedAdvances: outstanding.summary.totalUnallocatedAdvances,
            },
            dailyBook: {
              totalEntries: overview.dailyBook.totalEntries,
              received: overview.dailyBook.receivedCount,
              pending: overview.dailyBook.pendingCount,
            },
            driverVouchers: {
              total: overview.driverVouchers.totalVouchers,
              totalExpense: overview.driverVouchers.totalExpense,
            },
          },
        }, null, 2);
      }
    }
  } catch (err) {
    console.error("[AI Service] Context assembly error:", err);
    return JSON.stringify({
      error: "Context fetch failed. Limited data available.",
      asOf: new Date().toISOString().split("T")[0],
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main chat function
// ─────────────────────────────────────────────────────────────────────────────

export async function askAI(
  db: NodePgDatabase<any>,
  request: AIChatRequest
): Promise<AIChatResponse> {
  const groq = getGroqClient();
  const firmName = request.firmName || "Your Firm";

  // 1. Classify intent and fetch only the relevant context
  const intent = classifyIntent(request.message);
  const contextJson = await assembleFirmContext(db, request.firmId, intent);

  // 2. Build system prompt with strengthened guardrails
  const systemPrompt = buildSystemPrompt(firmName);

  // 3. Inject live data as a priming exchange before the user's actual question
  const contextMessage = `[LIVE FIRM DATA — scope: ${intent}]\n\n${contextJson}`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: contextMessage },
    { role: "assistant", content: "Understood. I have the live firm data for the requested scope. Please ask your question. I will answer in your language and will not invent or calculate any values." },
  ];

  // 4. Append recent history (last 6 turns = 3 exchanges)
  const recentHistory = (request.history || []).slice(-6);
  for (const turn of recentHistory) {
    messages.push({ role: turn.role, content: turn.content });
  }

  // 5. Append current user message
  messages.push({ role: "user", content: request.message });

  // 6. Call Groq
  const completion = await groq.chat.completions.create({
    model: AI_MODEL,
    messages,
    max_tokens: AI_MAX_TOKENS,
    temperature: AI_TEMPERATURE,
  });

  const answer =
    completion.choices[0]?.message?.content?.trim() ||
    "I could not generate a response. Please try again.";
  const tokensUsed = completion.usage?.total_tokens;

  return { answer, modelUsed: AI_MODEL, tokensUsed, intent };
}
