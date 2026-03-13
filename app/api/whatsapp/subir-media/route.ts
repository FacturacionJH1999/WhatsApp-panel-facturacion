import { NextResponse } from "next/server";

const API_KEY = process.env.D360_API_KEY;

export async function POST(req: Request) {
  try {
    if (!API_KEY) {
      return NextResponse.json(
        { error: "Falta D360_API_KEY" },
        { status: 500 }
      );
    }

    const formDataEntrada = await req.formData();
    const archivo = formDataEntrada.get("file");

    if (!(archivo instanceof File)) {
      return NextResponse.json(
        { error: "Archivo requerido" },
        { status: 400 }
      );
    }

    const formData = new FormData();
    formData.append("file", archivo, archivo.name);
    formData.append("messaging_product", "whatsapp");

    const response = await fetch("https://waba-v2.360dialog.io/media", {
      method: "POST",
      headers: {
        "D360-API-KEY": API_KEY,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: "Error subiendo media", detalle: data },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error subiendo media:", error);
    return NextResponse.json(
      { error: "Error subiendo media" },
      { status: 500 }
    );
  }
}