import { spawn, spawnSync } from "node:child_process";

if (
  !process.env.DATABASE_URL?.endsWith("/evidentia_test") ||
  process.env.OPENAI_API_KEY ||
  process.env.EVIDENTIA_TEST_SERVER !== "1"
) {
  throw new Error("Use somente a configuração sintética do Playwright, sem chave de IA.");
}
const next = "node_modules/next/dist/bin/next";
const build = spawnSync(process.execPath, [next, "build"], { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);
const server = spawn(
  process.execPath,
  [next, "start", "--hostname", "127.0.0.1", "--port", "3100"],
  { stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
