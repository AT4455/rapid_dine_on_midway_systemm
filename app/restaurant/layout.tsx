import { requirePageRestaurant } from "@/lib/auth/pages";
import { RestaurantShell } from "@/components/layout/restaurant-shell";
import { LiveUpdates } from "@/components/realtime/live-updates";

export const dynamic = "force-dynamic";

export default async function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const context = await requirePageRestaurant();

  return (
    <>
      <LiveUpdates />
      <RestaurantShell
        user={{ name: context.user.name, email: context.user.email, isDemo: context.user.isDemo }}
        restaurantName={context.restaurant.name}
      >
        {children}
      </RestaurantShell>
    </>
  );
}
