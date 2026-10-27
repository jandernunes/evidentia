import { Shell } from "@/components/ui";
import { pageUser } from "@/server/access";
export const dynamic = "force-dynamic";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser();
  return (
    <Shell name={user.name} role={user.role}>
      {children}
    </Shell>
  );
}
