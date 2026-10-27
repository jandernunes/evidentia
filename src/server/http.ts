import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./access";

export async function api(action: () => Promise<unknown>) {
  try {
    const result = await action();
    if (result instanceof Response) {
      result.headers.set("Cache-Control", "private, no-store");
      return result;
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const requestId = crypto.randomUUID();
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          code: "INVALID_INPUT",
          message: error.issues[0]?.message ?? "Confira os campos.",
          requestId,
        },
        { status: 400 },
      );
    if (error instanceof AppError)
      return NextResponse.json(
        { code: error.code, message: error.message, requestId },
        { status: error.status },
      );
    if (error && typeof error === "object" && "code" in error && error.code === "P2002")
      return NextResponse.json(
        {
          code: "CONFLICT",
          message: "Este registro já existe. Atualize a página para consultar o que foi salvo.",
          requestId,
        },
        { status: 409 },
      );
    if (error && typeof error === "object" && "code" in error && error.code === "P2003")
      return NextResponse.json(
        {
          code: "HAS_DEPENDENCIES",
          message: "Este cadastro possui vínculos. Desative-o para preservar o histórico.",
          requestId,
        },
        { status: 409 },
      );
    console.error(
      JSON.stringify({
        requestId,
        event: "request_failed",
        type: error instanceof Error ? error.name : "Unknown",
      }),
    );
    return NextResponse.json(
      {
        code: "UNAVAILABLE",
        message: "Não foi possível concluir agora. Tente novamente.",
        requestId,
      },
      { status: 503 },
    );
  }
}
export function sameOrigin(request: Request) {
  const expected = process.env.APP_BASE_URL;
  if (!expected || request.headers.get("origin") !== new URL(expected).origin)
    throw new AppError(403, "INVALID_ORIGIN", "Atualize a página e tente novamente.");
}
export async function readJson(request: Request, maxBytes = 80_000) {
  sameOrigin(request);
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AppError(413, "TOO_LARGE", "O conteúdo ultrapassa o limite permitido.");
      }
      chunks.push(chunk.value);
    }
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(400, "INVALID_JSON", "O conteúdo enviado não é válido.");
  }
}
