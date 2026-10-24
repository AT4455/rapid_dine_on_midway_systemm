import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { RestaurantRegisterForm } from "@/components/auth/restaurant-register-form";

export const metadata: Metadata = { title: "Kitchen sign up" };

export default function RestaurantRegisterPage() {
  return (
    <AuthLayout eyebrow="Kitchen partner">
      <RestaurantRegisterForm />
    </AuthLayout>
  );
}
