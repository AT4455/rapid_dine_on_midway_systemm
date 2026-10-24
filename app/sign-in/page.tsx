import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { RegisterChoice } from "@/components/auth/register-choice";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const mode = typeof params.mode === "string" ? params.mode : undefined;

  return (
    <AuthLayout eyebrow={mode === "register" ? "Join Rapid Dine" : "Sign in"}>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-12 w-full rounded-full" />
          </div>
        }
      >
        {mode === "register" ? <RegisterChoice /> : <SignInForm />}
      </Suspense>
    </AuthLayout>
  );
}
