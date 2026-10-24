import { redirect } from "next/navigation";

/** `/customer` is a namespace, not a destination. Send travellers to their dashboard. */
export default function CustomerIndexPage() {
  redirect("/customer/dashboard");
}
