import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;

  const rutasPublicas = ["/login"];
  const esRutaPublica = rutasPublicas.some((ruta) => pathname.startsWith(ruta));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (!esRutaPublica) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    return response;
  }

  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("id, rol, activo")
    .eq("id", user.id)
    .maybeSingle();

  if (errorPerfil || !perfil || !perfil.activo) {
    await supabase.auth.signOut();

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  const esRutaAdmin =
    pathname.startsWith("/admin") || pathname.startsWith("/usuarios");

  if (esRutaAdmin && perfil.rol !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/chat/:path*",
    "/conversaciones/:path*",
    "/admin/:path*",
    "/usuarios/:path*",
  ],
};