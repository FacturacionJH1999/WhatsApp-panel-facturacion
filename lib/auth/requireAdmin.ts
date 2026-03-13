import { redirect } from "next/navigation";
import { requireUser } from "./requireUser";

export async function requireAdmin() {
  const { user, perfil } = await requireUser();

  if (perfil.rol !== "admin") {
    redirect("/");
  }

  return { user, perfil };
}