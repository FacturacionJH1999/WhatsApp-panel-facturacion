import { NextResponse } from "next/server";
import { getUserProfile } from "@/lib/auth/getUserProfile";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RolUsuario = "admin" | "empleado";

type BodyCrearUsuario = {
  nombre?: string;
  email?: string;
  password?: string;
  rol?: RolUsuario;
  activo?: boolean;
};

function esRolValido(valor: unknown): valor is RolUsuario {
  return valor === "admin" || valor === "empleado";
}

export async function POST(request: Request) {
  try {
    const { perfil } = await getUserProfile();

    if (!perfil) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401 }
      );
    }

    if (perfil.rol !== "admin") {
      return NextResponse.json(
        { error: "No tienes permisos para crear usuarios." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as BodyCrearUsuario;

    const nombre = body.nombre?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const rol = body.rol;
    const activo = typeof body.activo === "boolean" ? body.activo : true;

    if (!nombre) {
      return NextResponse.json(
        { error: "El nombre es obligatorio." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "El correo es obligatorio." },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    if (!esRolValido(rol)) {
      return NextResponse.json(
        { error: "El rol enviado no es válido." },
        { status: 400 }
      );
    }

    const { data: usuarioExistenteEnPerfil, error: errorBuscandoPerfil } =
      await supabaseAdmin
        .from("perfiles")
        .select("id, email")
        .eq("email", email)
        .maybeSingle();

    if (errorBuscandoPerfil) {
      console.error("Error validando email existente en perfiles:", errorBuscandoPerfil);
      return NextResponse.json(
        { error: "No se pudo validar si el correo ya existe." },
        { status: 500 }
      );
    }

    if (usuarioExistenteEnPerfil) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese correo." },
        { status: 409 }
      );
    }

    const { data: resultadoAuth, error: errorCreandoAuth } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nombre,
          rol,
        },
      });

    if (errorCreandoAuth || !resultadoAuth.user) {
      console.error("Error creando usuario en auth:", errorCreandoAuth);
      return NextResponse.json(
        {
          error:
            errorCreandoAuth?.message ??
            "No se pudo crear el usuario en autenticación.",
        },
        { status: 500 }
      );
    }

    const usuarioCreado = resultadoAuth.user;

    const { error: errorInsertandoPerfil } = await supabaseAdmin
      .from("perfiles")
      .insert({
        id: usuarioCreado.id,
        nombre,
        email,
        rol,
        activo,
      });

    if (errorInsertandoPerfil) {
      console.error("Error creando perfil:", errorInsertandoPerfil);

      await supabaseAdmin.auth.admin.deleteUser(usuarioCreado.id);

      return NextResponse.json(
        { error: "No se pudo crear el perfil del usuario." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      usuario: {
        id: usuarioCreado.id,
        nombre,
        email,
        rol,
        activo,
      },
    });
  } catch (error) {
    console.error("Error inesperado creando usuario:", error);
    return NextResponse.json(
      { error: "Ocurrió un error inesperado." },
      { status: 500 }
    );
  }
}