import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, mensaje: "Webhook activo" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("Webhook recibido:", JSON.stringify(body, null, 2));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en webhook:", error);
    return NextResponse.json(
      { ok: false, error: "Error procesando webhook" },
      { status: 500 }
    );
  }
}