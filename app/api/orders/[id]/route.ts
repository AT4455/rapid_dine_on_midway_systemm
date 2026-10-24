import { prisma } from "@/lib/db";
import { assertOrderAccess } from "@/lib/auth/guards";
import { haversineMeters } from "@/lib/geo";
import { handleApiError, jsonOk } from "@/lib/http";
import { orderInclude } from "@/lib/services/order";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const access = await assertOrderAccess(id);
    const order = await prisma.order.findUniqueOrThrow({
      where: { id },
      include: orderInclude,
    });

    let latestLocation = null;
    if (order.journeyId && ["ACCEPTED", "PREPARING", "READY"].includes(order.status)) {
      latestLocation = await prisma.locationUpdate.findFirst({
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
      });
    }

    const distanceToKitchenMeters = latestLocation
      ? Math.round(
          haversineMeters(
            { lat: Number(latestLocation.latitude), lng: Number(latestLocation.longitude) },
            { lat: Number(order.restaurant.latitude), lng: Number(order.restaurant.longitude) },
          ),
        )
      : null;

    return jsonOk({
      order,
      side: access.side,
      latestLocation,
      distanceToKitchenMeters,
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
