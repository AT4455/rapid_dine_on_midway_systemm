import { redirect } from "next/navigation";
import { getAuthUser, getRestaurantContext, type AuthUser, type RestaurantContext } from "./guards";

export async function requirePageCustomer(nextPath?: string): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) redirect(`/sign-in${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  if (user.role !== "CUSTOMER") redirect("/restaurant/dashboard?denied=customer");
  return user;
}

export async function requirePageRestaurant(nextPath?: string): Promise<RestaurantContext> {
  const user = await getAuthUser();
  if (!user) redirect(`/sign-in${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  if (user.role !== "RESTAURANT") redirect("/customer/dashboard?denied=restaurant");
  const context = await getRestaurantContext(user.id);
  if (!context) redirect("/onboarding/restaurant");
  return context;
}
