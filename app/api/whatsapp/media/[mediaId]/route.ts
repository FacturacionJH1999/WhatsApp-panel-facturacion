import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = {
  params: Promise<{ mediaId: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { mediaId } = await params;

    const apiKey = process.env.D360_API_KEY || process.env.WHATSAPP_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Falta D360_API_KEY en variables de entorno" },
        { status: 500 }
      );
    }

    if (!mediaId) {
      return NextResponse.json(
        { ok: false, error: "mediaId requerido" },
        { status: 400 }
      );
    }

    const infoResponse = await fetch(`https://waba-v2.360dialog.io/${mediaId}`, {
      method: "GET",
      headers: {
        "D360-API-KEY": apiKey,
      },
      cache: "no-store",
    });

    if (!infoResponse.ok) {
      const detalle = await infoResponse.text();
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo obtener la URL del media",
          detalle,
        },
        { status: 502 }
      );
    }

    const info = await infoResponse.json();
    const mediaUrl = info?.url;

    if (!mediaUrl) {
      return NextResponse.json(
        { ok: false, error: "360dialog no devolvió URL del media" },
        { status: 502 }
      );
    }

    const downloadUrl = mediaUrl.replace(
      "https://lookaside.fbsbx.com",
      "https://waba-v2.360dialog.io"
    );

    const mediaResponse = await fetch(downloadUrl, {
      method: "GET",
      headers: {
        "D360-API-KEY": apiKey,
      },
      cache: "no-store",
      redirect: "follow",
    });

    if (!mediaResponse.ok) {
      const detalle = await mediaResponse.text();
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo descargar el media",
          detalle,
        },
        { status: 502 }
      );
    }

    const contentType =
      mediaResponse.headers.get("content-type") || "application/octet-stream";

    const buffer = await mediaResponse.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error sirviendo media de WhatsApp:", error);
    return NextResponse.json(
      { ok: false, error: "Error obteniendo media" },
      { status: 500 }
    );
  }
}