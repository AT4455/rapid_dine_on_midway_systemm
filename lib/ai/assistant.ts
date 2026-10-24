import { prisma } from "../db";
import { config } from "../config";
import { HttpError } from "../http";
import { discoverRestaurants } from "../services/discovery";
import { parseJsonArray, toNumber } from "../utils";
import {
  ruleBasedReply,
  type AiMenuItem,
  type AiRestaurant,
  type AssistantContext,
} from "./rules";

async function buildContext(userId: string, journeyId?: string): Promise<AssistantContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { customerProfile: true },
  });
  if (!user) throw new HttpError(404, "User not found.", "not_found");

  const journey = journeyId
    ? await prisma.journey.findFirst({ where: { id: journeyId, customerId: userId } })
    : await prisma.journey.findFirst({
        where: { customerId: userId, status: { in: ["PLANNED", "ACTIVE"] } },
        orderBy: { createdAt: "desc" },
      });

  const discovered = journey ? await discoverRestaurants(journey) : [];
  const restaurantIds = discovered.map((r) => r.id);
  const menuItems = restaurantIds.length
    ? await prisma.menuItem.findMany({
        where: { restaurantId: { in: restaurantIds }, isAvailable: true, isArchived: false },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      })
    : [];

  const menuByRestaurant = new Map<string, AiMenuItem[]>();
  for (const item of menuItems) {
    const list = menuByRestaurant.get(item.restaurantId) ?? [];
    list.push({
      id: item.id,
      name: item.name,
      description: item.description,
      price: toNumber(item.price),
      prepTimeMinutes: item.prepTimeMinutes,
      dietaryTags: parseJsonArray(item.dietaryTags),
      allergens: parseJsonArray(item.allergens),
    });
    menuByRestaurant.set(item.restaurantId, list);
  }

  const restaurants: AiRestaurant[] = discovered.map((r) => ({
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    etaMinutes: r.etaMinutes,
    detourMeters: r.detourMeters,
    openNow: r.openNow,
    activeOrders: r.activeOrders,
    capacityPerHour: r.capacityPerHour,
    rating: r.rating,
    prepTimeMinutes: r.prepTimeMinutes,
    priceRange: r.priceRange,
    dietaryTags: r.dietaryTags,
    suitabilityLabel: r.suitabilityLabel,
    menu: (menuByRestaurant.get(r.id) ?? []).slice(0, 14),
  }));

  return {
    userName: user.name,
    dietaryPreferences: parseJsonArray(user.customerProfile?.dietaryPreferences),
    allergies: user.customerProfile?.allergies ?? "",
    budget: toNumber(user.customerProfile?.defaultBudget) || 500,
    currency: user.customerProfile?.currency ?? "INR",
    journey: journey
      ? {
          id: journey.id,
          startLabel: journey.startLabel,
          endLabel: journey.endLabel,
          durationMinutes: Math.round(journey.routeDurationSeconds / 60),
          corridorMeters: journey.corridorMeters,
          status: journey.status,
        }
      : null,
    restaurants,
  };
}

const SYSTEM_PROMPT = `You are Rapid Dine's travel-food concierge for travellers in India.
Rules you must never break:
1. Use ONLY the CONTEXT JSON. Never invent restaurants, dishes, prices, ratings, availability, ETAs, or bookings.
2. If the context lacks something, say so and suggest planning a journey or widening the corridor.
3. Recommend 1-3 restaurants with 1-2 actual dishes each, quoting the exact price and prep time from the context.
4. Explain arrival suitability using the restaurant's etaMinutes, prepTimeMinutes and detourMeters.
5. Respect declared allergies. Never claim a dish is allergy-safe; add a short cross-contamination warning.
6. Prices are INR. Checkout adds a 3% service fee + ₹5 platform fee (already included in budget matching).
7. Never claim an order is placed. The traveller must confirm checkout themselves.
8. Be concise: under 170 words, short bullets, warm and practical. No markdown tables.`;

async function callLlm(
  context: AssistantContext,
  history: Array<{ role: string; content: string }>,
  message: string,
) {
  const compactContext = {
    ...context,
    restaurants: context.restaurants.slice(0, 8).map((r) => ({
      ...r,
      menu: r.menu.slice(0, 8),
    })),
  };
  const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.ai.model,
      temperature: 0.3,
      max_tokens: 550,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "system",
          content: `CONTEXT JSON:\n${JSON.stringify(compactContext)}`,
        },
        ...history.slice(-8).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        { role: "user", content: message },
      ],
    }),
    signal: AbortSignal.timeout(config.ai.timeoutMs),
  });
  if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("LLM returned an empty answer");
  return content;
}

export async function chatWithAssistant(params: {
  userId: string;
  message: string;
  conversationId?: string;
  journeyId?: string;
}) {
  const context = await buildContext(params.userId, params.journeyId);

  let conversation = params.conversationId
    ? await prisma.aIConversation.findFirst({
        where: { id: params.conversationId, userId: params.userId },
      })
    : null;
  if (params.conversationId && !conversation) {
    throw new HttpError(404, "Conversation not found.", "not_found");
  }
  if (!conversation) {
    conversation = await prisma.aIConversation.create({
      data: {
        userId: params.userId,
        journeyId: context.journey?.id,
        title: params.message.slice(0, 70),
      },
    });
  }

  const history = await prisma.aIMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 12,
    select: { role: true, content: true },
  });

  let reply: string;
  let mode: "llm" | "rules" = "rules";
  let suggestions: string[] = [];
  let fallbackReason: string | undefined;
  let recommended: Array<{ restaurantId: string; restaurantName: string; items: string[] }> = [];

  const rulesAnswer = ruleBasedReply(context, params.message);
  suggestions = rulesAnswer.suggestions;
  recommended = rulesAnswer.recommended;

  if (config.ai.enabled) {
    try {
      reply = await callLlm(context, history, params.message);
      mode = "llm";
    } catch (error) {
      fallbackReason = error instanceof Error ? error.message.slice(0, 120) : "LLM request failed";
      reply = rulesAnswer.reply;
      mode = "rules";
    }
  } else {
    fallbackReason = "LLM_API_KEY is not configured";
    reply = rulesAnswer.reply;
  }

  await prisma.$transaction([
    prisma.aIMessage.create({
      data: { conversationId: conversation.id, role: "user", content: params.message },
    }),
    prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: reply,
        meta: { mode, model: mode === "llm" ? config.ai.model : "rule-based", recommended },
      },
    }),
    prisma.aIConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date(), journeyId: context.journey?.id ?? undefined },
    }),
  ]);

  return {
    conversationId: conversation.id,
    reply,
    mode,
    fallbackReason,
    suggestions,
    recommended,
    contextSummary: {
      journey: context.journey
        ? `${context.journey.startLabel} → ${context.journey.endLabel}`
        : null,
      restaurantsInCorridor: context.restaurants.length,
      openRestaurants: context.restaurants.filter((r) => r.openNow).length,
      budget: context.budget,
    },
  };
}

export async function getConversation(userId: string, conversationId: string) {
  const conversation = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) throw new HttpError(404, "Conversation not found.", "not_found");
  return conversation;
}
