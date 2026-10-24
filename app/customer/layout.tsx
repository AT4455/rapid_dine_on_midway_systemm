import { requirePageCustomer } from "@/lib/auth/pages";
import { CartProvider } from "@/components/providers/cart-provider";
import { CustomerShell } from "@/components/layout/customer-shell";
import { LiveUpdates } from "@/components/realtime/live-updates";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageCustomer();

  return (
    <CartProvider>
      <LiveUpdates />
      <CustomerShell user={{ name: user.name, email: user.email, isDemo: user.isDemo }}>
        {children}
      </CustomerShell>
    </CartProvider>
  );
}
