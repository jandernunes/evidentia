import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "EvidentIA", template: "%s | EvidentIA" },
  description: "Microarguição adaptativa com evidências revisadas pelo professor.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
