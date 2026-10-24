import { prisma } from "@/lib/db";
import { assertOrderAccess } from "@/lib/auth/guards";
import { assertSameOrigin, handleApiError, HttpError, jsonOk, readJson } from "@/lib/http";
import { locationUpdateSchema } from "@/lib/validation";
import { recordLocation } from "@/lib/services/tracking";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const access = await assertOrderAccess(id);
    if (access.side !== "customer") {
      throw new HttpError(403, "Only the traveller can share location for this order.", "forbidden");
    }
    if (!access.order.journeyId) {
      throw new HttpError(409, "This order has no journey attached.", "no_journey");
    }
    const body = locationUpdateSchema.parse(await readJson(request));
    const result = await recordLocation({
      customerId: access.user.id,
      journeyId: access.order.journeyId,
      latitude: body.latitude,
      longitude: body.longitude,
      accuracyMeters: body.accuracyMeters,
      source: body.source,
      recordedAt: body.recordedAt,
    });
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const access = await assertOrderAccess(id);
    const order = await prisma.order.findUnique({
      where: { id },
      select: { journeyId: true, status: true, estimatedReadyAt: true, etaUpdatedAt: true },
    });
    if (!order?.journeyId) return jsonOk({ location: null, journey: null });

    const journey = await prisma.journey.findUnique({
      where: { id: order.journeyId },
      select: { id: true, status: true, lastLocationAt: true, lastEtaAt: true, lastEtaSeconds: true, endedAt: true },
    });
    const location =
      access.side === "restaurant" || access.side === "customer"
        ? await prisma.locationUpdate.findFirst({
            where: { journeyId: order.journeyId },
            orderBy: { recordedAt: "desc" },
            select: {
              latitude: true,
              longitude: true,
              accuracyMeters: true,
              recordedAt: true,
              etaSeconds: true,
              source: true,
            },
          })
        : null;

    return jsonOk({ location, journey, order, serverNow: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}
