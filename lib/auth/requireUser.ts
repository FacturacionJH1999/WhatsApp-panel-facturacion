import { redirect } from "next/navigation";
import { getUserProfile } from "./getUserProfile";

export async function requireUser() {
  const { user, perfil } = await getUserProfile();

  if (!user || !perfil) {
    redirect("/login");
  }

  return { user, perfil };
}