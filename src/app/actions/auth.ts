"use server";
import { redirect } from "next/navigation";
import { loginWithPin, logout } from "@/lib/auth";

export async function scorerLoginAction(formData: FormData) {
  const pin = String(formData.get("pin") ?? "");
  const ok = loginWithPin(pin);
  if (!ok) redirect("/score/login?error=1");
  const next = String(formData.get("next") ?? "/");
  redirect(next);
}

export async function scorerLogoutAction() {
  logout();
  redirect("/");
}

