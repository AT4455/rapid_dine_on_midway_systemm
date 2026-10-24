import { requireApiCustomer } from "@/lib/auth/guards";
import { assertSameOrigin, handleApiError, jsonOk, readJson } from "@/lib/http";
import { aiChatSchema } from "@/lib/validation";
import { chatWithAssistant } from "@/lib/ai/assistant";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiCustomer();
    enforceRateLimit(`ai:${user.id}`, 20, 5 * 60_000);
    const body = aiChatSchema.parse(await readJson(request));
    const result = await chatWithAssistant({
      userId: user.id,
      message: body.message,
      conversationId: body.conversationId,
      journeyId: body.journeyId,
    });
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
