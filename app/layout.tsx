import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/fraunces";
import "./globals.css";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: {
    default: "Rapid Dine — eat well along the way",
    template: "%s · Rapid Dine",
  },
  description:
    "Route-aware food bounties for travellers. Order ahead from kitchens along your journey, arrive to a warm meal, and let the kitchen time the cooking to your ETA.",
  applicationName: "Rapid Dine",
  keywords: ["route-aware ordering", "travel food", "bounty", "road trip", "just-in-time kitchen"],
  openGraph: {
    title: "Rapid Dine — eat well along the way",
    description:
      "Publish a food bounty along your route. Eligible kitchens accept, cook just in time, and have your meal ready when you arrive.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf7f0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <TooltipProvider delayDuration={250}>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              classNames: {
                toast: "!rounded-2xl !border-border !bg-card !text-foreground !shadow-lift",
                description: "!text-muted-foreground",
              },
            }}
          />
        </TooltipProvider>
      </body>
    </html>
  );
}
