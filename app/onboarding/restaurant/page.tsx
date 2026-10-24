import Link from "next/link";
import { redirect } from "next/navigation";
import { ChefHat, LogOut, Store } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getAuthUser, getRestaurantContext } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finish kitchen setup" };

export default async function RestaurantOnboardingPage() {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in?next=/onboarding/restaurant");
  if (user.role !== "RESTAURANT") redirect("/customer/dashboard");
  const context = await getRestaurantContext(user.id);
  if (context) redirect("/restaurant/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-radial-warm">
      <header className="container-wide flex h-16 items-center">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="surface w-full max-w-lg p-6 sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-orange-700">
            <ChefHat className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">
            Your partner account has no kitchen yet.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Signed in as {user.email}. Register a kitchen to receive bounties, or sign in with an account that is
            already linked. Demo accounts are seeded with kitchens.
          </p>

          <div className="mt-6 space-y-2">
            <Button asChild className="w-full" size="lg">
              <Link href="/register/restaurant">
                <Store /> Register a kitchen
              </Link>
            </Button>
            <form action="/api/auth/logout" method="post">
              <Button type="submit" variant="outline" className="w-full">
                <LogOut /> Sign out
              </Button>
            </form>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Or try the seeded kitchen from the{" "}
            <Link href="/sign-in" className="font-semibold text-primary-800 hover:underline">sign-in page</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
