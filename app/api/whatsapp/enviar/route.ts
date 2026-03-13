import { NextResponse } from "next/server";

const API_KEY = process.env.D360_API_KEY;
const PHONE_NUMBER_ID = process.env.D360_PHONE_NUMBER_ID;

export async function POST(req: Request) {
  try {
    const { telefono, texto } = await req.json();

    if (!telefono || !texto) {
      return NextResponse.json(
        { error: "telefono y texto son requeridos" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://waba-v2.360dialog.io/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "D360-API-KEY": API_KEY!,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: telefono,
          type: "text",
          text: {
            body: texto,
          },
        }),
      }
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error enviando mensaje:", error);

    return NextResponse.json(
      { error: "Error enviando mensaje" },
      { status: 500 }
    );
  }
}