import { AdminShell } from "@/components/admin/admin-shell";

/** Admin hits Supabase at request time — never static-prerender without env. */
export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
