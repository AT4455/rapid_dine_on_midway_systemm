import type { Metadata } from "next";
import { RestaurantMenuView } from "@/components/customer/restaurant-menu-view";

export const metadata: Metadata = { title: "Kitchen menu" };
export const dynamic = "force-dynamic";

export default async function CustomerRestaurantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const journeyId = typeof query.journeyId === "string" ? query.journeyId : null;

  return <RestaurantMenuView restaurantId={id} journeyId={journeyId} />;
}
