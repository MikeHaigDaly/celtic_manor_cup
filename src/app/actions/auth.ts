"use server";
import { redirect } from "next/navigation";
import { loginWithTeamsPin, logoutTeams } from "@/lib/auth";

export async function teamsLoginAction(formData: FormData) {
  const pin = String(formData.get("pin") ?? "");
  const ok = loginWithTeamsPin(pin);
  if (!ok) redirect("/teams/login?error=1");
  const next = String(formData.get("next") ?? "/teams");
  redirect(next);
}

export async function teamsLogoutAction() {
  logoutTeams();
  redirect("/teams");
}

