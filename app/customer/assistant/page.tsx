"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowRight,
  Bot,
  ChefHat,
  Info,
  Loader2,
  MapPin,
  MessageCircle,
  Send,
  ShieldAlert,
  Sparkles,
  UserRound,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetcher, postJson } from "@/lib/client/api";
import type { AiChatResponse, JourneyListItem } from "@/lib/client/types";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "llm" | "rules";
  fallbackReason?: string;
  suggestions?: string[];
  recommended?: AiChatResponse["recommended"];
};

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your route food concierge. I can only recommend kitchens and dishes that are actually on your planned corridor, so tell me what you feel like eating — or pick a prompt below.",
  suggestions: [
    "What can I eat near Ramanagara?",
    "I'm vegetarian — suggest a quick meal",
    "Best budget stop before Mysuru?",
  ],
};

export default function CustomerAssistantPage() {
  const { data: journeyData } = useSWR<{ journeys: JourneyListItem[] }>("/api/journeys", fetcher);
  const journeys = (journeyData?.journeys ?? []).filter((journey) => journey.status === "PLANNED" || journey.status === "ACTIVE");

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [journeyId, setJourneyId] = useState("auto");
  const [summary, setSummary] = useState<AiChatResponse["contextSummary"] | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const latestSuggestions = [...messages].reverse().find((message) => message.role === "assistant")?.suggestions ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    setInput("");
    setBusy(true);
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", content: message }]);

    try {
      const response = await postJson<AiChatResponse>("/api/ai/chat", {
        message,
        conversationId,
        ...(journeyId !== "auto" ? { journeyId } : {}),
      });
      setConversationId(response.conversationId);
      setSummary(response.contextSummary);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.reply,
          mode: response.mode,
          fallbackReason: response.fallbackReason,
          suggestions: response.suggestions,
          recommended: response.recommended,
        },
      ]);
    } catch (sendError) {
      const failure = sendError instanceof Error ? sendError.message : "The assistant could not answer.";
      toast.error(failure);
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `I couldn't answer that just now. ${failure}`,
          mode: "rules",
          fallbackReason: "Request failed",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Route concierge"
        title="Food assistant"
        description="Ask about dishes, budgets, dietary needs or timing. Answers are grounded in the kitchens and menus on your current corridor — never invented places."
        action={
          journeys.length > 0 ? (
            <Select value={journeyId} onValueChange={setJourneyId}>
              <SelectTrigger className="w-full sm:w-72" aria-label="Choose a journey">
                <SelectValue placeholder="Use my latest journey" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Latest active journey</SelectItem>
                {journeys.map((journey) => (
                  <SelectItem key={journey.id} value={journey.id}>
                    {journey.startLabel} → {journey.endLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Button asChild><Link href="/customer/journeys/new"><MapPin /> Plan a journey</Link></Button>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <Card className="flex min-h-[560px] flex-col">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/70 pb-3">
            <CardTitle className="flex items-center gap-2 text-lg"><MessageCircle className="h-4 w-4" /> Conversation</CardTitle>
            <Badge variant="outline">{conversationId ? "Thread saved" : "New thread"}</Badge>
          </CardHeader>

          <CardContent className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {messages.map((message) => (
              <div key={message.id} className={cn("flex gap-2.5", message.role === "user" ? "justify-end" : "justify-start")}>
                {message.role === "assistant" ? (
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-100 text-primary-800">
                    <Bot className="h-4 w-4" />
                  </span>
                ) : null}

                <div className={cn("max-w-[85%] space-y-2", message.role === "user" && "items-end text-right")}>
                  <div
                    className={cn(
                      "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      message.role === "user"
                        ? "rounded-tr-sm bg-primary text-primary-foreground"
                        : "rounded-tl-sm border border-border bg-white",
                    )}
                  >
                    <p className="whitespace-pre-wrap text-left">{message.content}</p>
                  </div>

                  {message.role === "assistant" && message.mode ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {message.mode === "llm" ? (
                        <Badge variant="success"><Sparkles className="h-3 w-3" /> AI model</Badge>
                      ) : (
                        <Badge variant="warning"><WifiOff className="h-3 w-3" /> Rule-based fallback</Badge>
                      )}
                      {message.mode === "rules" && message.fallbackReason ? (
                        <span className="text-[10px] text-muted-foreground">{message.fallbackReason}</span>
                      ) : null}
                    </div>
                  ) : null}

                  {message.recommended && message.recommended.length > 0 ? (
                    <div className="space-y-1.5 text-left">
                      {message.recommended.map((item) => (
                        <div key={`${item.restaurantId}-${item.restaurantName}`} className="rounded-xl border border-primary-200 bg-primary-50/50 px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-semibold"><ChefHat className="h-3.5 w-3.5 text-primary-700" /> {item.restaurantName}</span>
                            <Button asChild size="sm" variant="ghost" className="h-6 px-2">
                              <Link href={`/customer/restaurants/${item.restaurantId}${journeyId !== "auto" ? `?journeyId=${journeyId}` : ""}`}>
                                Menu <ArrowRight />
                              </Link>
                            </Button>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{item.items.join(" · ")}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {message.suggestions && message.suggestions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 text-left">
                      {message.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void send(suggestion)}
                          disabled={busy}
                          className="rounded-full border border-primary-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-primary-800 transition-colors hover:bg-primary-50 disabled:opacity-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {message.role === "user" ? (
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <UserRound className="h-4 w-4" />
                  </span>
                ) : null}
              </div>
            ))}

            {busy ? (
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-100 text-primary-800"><Bot className="h-4 w-4" /></span>
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-white px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking your corridor…
                </div>
              </div>
            ) : null}

            <div ref={bottomRef} />
          </CardContent>

          <div className="border-t border-border/70 p-3 sm:p-4">
            {latestSuggestions.length > 0 && !busy ? (
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
                {latestSuggestions.slice(0, 4).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-primary-50 hover:text-primary-800"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send(input);
              }}
              className="flex items-end gap-2"
            >
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(input);
                  }
                }}
                placeholder="Ask about dishes, budget, timing or dietary needs…"
                className="min-h-[52px] flex-1 resize-none"
                maxLength={2000}
                disabled={busy}
                aria-label="Message the food assistant"
              />
              <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={busy || !input.trim()}>
                {busy ? <Loader2 className="animate-spin" /> : <Send />}
                <span className="sr-only">Send</span>
              </Button>
            </form>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              Enter sends · Shift+Enter adds a line · answers use your saved preferences and the latest journey context.
            </p>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="border-primary-200 bg-primary-50/40">
            <CardHeader className="pb-2">
              <p className="eyebrow">Grounding</p>
              <CardTitle className="text-lg">What I can see</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
              {summary ? (
                <>
                  <Row label="Journey" value={summary.journey ?? "No active journey"} />
                  <Row label="Kitchens in corridor" value={String(summary.restaurantsInCorridor)} />
                  <Row label="Open right now" value={String(summary.openRestaurants)} />
                  <Row label="Budget context" value={`₹${summary.budget}`} />
                </>
              ) : (
                <p>
                  Send a message to see a summary of the context the assistant used. Without a journey it can only explain
                  the service, not recommend specific kitchens.
                </p>
              )}
              <p className="rounded-lg bg-white/70 p-2.5">
                The assistant reads your dietary preferences and allergies, your latest active journey, the verified
                kitchens inside its corridor, and their live menus. It cannot place orders or hold tables.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">How fallback works</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
              <p className="flex items-start gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> When an LLM API key is configured, answers come from the model. Every reply is labelled so you know which mode you got.</p>
              <p className="flex items-start gap-2"><WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Without a key or when the provider fails, a deterministic rules engine answers from the same grounded data. It is less flexible, never less truthful.</p>
              <p className="flex items-start gap-2"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Allergy notes are guidance, not a guarantee. Confirm ingredients and cross-contamination with the kitchen before ordering.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Good prompts</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {[
                "Which open kitchen has the shortest detour?",
                "Something spicy under ₹300, no nuts",
                "Will I make it if I stop in Mandya?",
                "Jain-friendly dinner near Srirangapatna",
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void send(prompt)}
                  disabled={busy}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors hover:border-primary-200 hover:bg-primary-50 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5 last:border-0">
      <span>{label}</span>
      <span className="text-right font-semibold text-foreground">{value}</span>
    </div>
  );
}
