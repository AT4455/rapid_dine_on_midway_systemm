import { assertOrderAccess } from "@/lib/auth/guards";
import { assertSameOrigin, handleApiError, jsonOk, readJson } from "@/lib/http";
import { orderStatusSchema } from "@/lib/validation";
import { updateOrderStatus } from "@/lib/services/order";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const access = await assertOrderAccess(id);
    const body = orderStatusSchema.parse(await readJson(request));

    const order = await updateOrderStatus({
      orderId: id,
      actor: {
        role: access.side === "customer" ? "CUSTOMER" : "RESTAURANT",
        userId: access.user.id,
        restaurantId: access.side === "restaurant" ? access.order.restaurantId : undefined,
      },
      toStatus: body.status,
      note: body.note,
    });

    return jsonOk({ order });
  } catch (error) {
    return handleApiError(error);
  }
}
