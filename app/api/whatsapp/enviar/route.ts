import { NextResponse } from "next/server";
import { guardarMensajeSaliente } from "@/lib/whatsapp/guardarMensajeSaliente";

const API_KEY = process.env.D360_API_KEY;

export async function POST(req: Request) {
  try {
    const { telefono, texto } = await req.json();

    if (!telefono || !texto?.trim()) {
      return NextResponse.json(
        { error: "telefono y texto son requeridos" },
        { status: 400 }
      );
    }

    if (!API_KEY) {
      return NextResponse.json(
        { error: "Falta D360_API_KEY" },
        { status: 500 }
      );
    }

    const response = await fetch("https://waba-v2.360dialog.io/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "D360-API-KEY": API_KEY,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefono,
        type: "text",
        text: {
          body: texto.trim(),
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Error enviando mensaje a WhatsApp",
          detalle: data,
        },
        { status: response.status }
      );
    }

    const waMessageId =
      data?.messages?.[0]?.id ??
      data?.message_id ??
      null;

    await guardarMensajeSaliente({
      telefono,
      texto: texto.trim(),
      waMessageId,
      fechaMensaje: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      waMessageId,
      data,
    });
  } catch (error) {
    console.error("Error enviando mensaje:", error);

    return NextResponse.json(
      { error: "Error enviando mensaje" },
      { status: 500 }
    );
  }
}