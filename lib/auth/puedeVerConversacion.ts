import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PerfilBasico = {
  id: string;
  rol: "admin" | "empleado";
};

export async function puedeVerConversacion(
  perfil: PerfilBasico,
  conversacionId: string
) {
  if (perfil.rol === "admin") {
    return true;
  }

  const { data, error } = await supabaseAdmin
    .from("conversaciones_asignadas")
    .select("id")
    .eq("conversacion_id", conversacionId)
    .eq("usuario_id", perfil.id)
    .maybeSingle();

  if (error) {
    console.error("Error validando acceso a conversación:", error);
    return false;
  }

  return !!data;
}