import { requireApiUser } from "@/lib/auth/guards";
import { assertSameOrigin, handleApiError, jsonOk, readJson } from "@/lib/http";
import { listNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/db";
import { z } from "zod";

export async function GET() {
  try {
    const user = await requireApiUser();
    const result = await listNotifications(user.id);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

const readSchema = z.object({ id: z.string().optional() });

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const body = readSchema.parse(await readJson(request).catch(() => ({})));
    if (body.id) {
      await prisma.notification.updateMany({
        where: { id: body.id, userId: user.id },
        data: { readAt: new Date() },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
    }
    const result = await listNotifications(user.id);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
