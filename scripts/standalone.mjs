import { cpSync, existsSync } from "node:fs";

if (!existsSync(".next/standalone/server.js")) throw new Error("Build standalone não encontrado.");
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
cpSync("public", ".next/standalone/public", { recursive: true });
