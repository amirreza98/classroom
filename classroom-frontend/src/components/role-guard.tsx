// components/role-guard.tsx
import { useSession } from "@/lib/auth-client";
import { Navigate, Outlet } from "react-router";

type Props = {
  allowedRoles: ('student' | 'teacher' | 'admin')[];
}

export function RoleGuard({ allowedRoles }: Props) {
  const { data: session } = useSession();
  const role = session?.user?.role as string;

  if (!allowedRoles.includes(role as any)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}