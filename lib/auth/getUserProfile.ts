import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export async function getUserProfile() {
  const supabase = await crearClienteSupabaseServidor();

  const {
    data: { user },
    error: errorUsuario,
  } = await supabase.auth.getUser();

  if (errorUsuario || !user) {
    return { user: null, perfil: null };
  }

  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("id, nombre, email, rol, activo")
    .eq("id", user.id)
    .maybeSingle();

  if (errorPerfil || !perfil || !perfil.activo) {
    return { user, perfil: null };
  }

  return { user, perfil };
}