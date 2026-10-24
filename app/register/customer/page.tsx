import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { CustomerRegisterForm } from "@/components/auth/customer-register-form";

export const metadata: Metadata = { title: "Traveller sign up" };

export default function CustomerRegisterPage() {
  return (
    <AuthLayout eyebrow="Traveller account">
      <CustomerRegisterForm />
    </AuthLayout>
  );
}
