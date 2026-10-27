import { authConfigured, getAuth } from "@/server/auth";
export const runtime = "nodejs";
async function handler(request: Request) {
  if (!authConfigured())
    return Response.json(
      { message: "Configure o banco e a autenticação no arquivo de ambiente para entrar." },
      { status: 503 },
    );
  return getAuth().handler(request);
}

export { handler as GET, handler as POST };
