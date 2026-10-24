import { redirect } from "next/navigation";

/** `/restaurant` is a namespace, not a destination. Send kitchens to their dashboard. */
export default function RestaurantIndexPage() {
  redirect("/restaurant/dashboard");
}
