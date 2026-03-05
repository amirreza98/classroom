import { useMemo, useState } from "react";
import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { CreateButton } from "@/components/refine-ui/buttons/create";
import { ShowButton } from "@/components/refine-ui/buttons/show";
import { EditButton } from "@/components/refine-ui/buttons/edit";
import { DeleteButton } from "@/components/refine-ui/buttons/delete";
import { useTable } from "@refinedev/react-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { User, UserRole } from "@/types";

const ROLE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    admin: "destructive",
    teacher: "default",
    student: "secondary",
};

const UsersList = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRole, setSelectedRole] = useState("all");

    const roleFilters = selectedRole === "all" ? [] : [
        { field: "role", operator: "eq" as const, value: selectedRole }
    ];
    const searchFilters = searchQuery ? [
        { field: "name", operator: "contains" as const, value: searchQuery }
    ] : [];

    const columns = useMemo<ColumnDef<User>[]>(() => [
        {
            id: "avatar",
            size: 60,
            header: () => <p className="column-title">Avatar</p>,
            cell: ({ row }) => {
                const user = row.original;
                const initials = user.name.split(" ").slice(0, 2).map(p => p[0]?.toUpperCase()).join("");
                return user.image ? (
                    <img src={user.image} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {initials}
                    </div>
                );
            }
        },
        {
            id: "name",
            accessorKey: "name",
            header: () => <p className="column-title">Name</p>,
            cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>
        },
        {
            id: "email",
            accessorKey: "email",
            header: () => <p className="column-title">Email</p>,
            cell: ({ getValue }) => <span className="text-muted-foreground text-sm">{getValue<string>()}</span>
        },
        {
            id: "role",
            accessorKey: "role",
            header: () => <p className="column-title">Role</p>,
            cell: ({ getValue }) => {
                const role = getValue<string>();
                return <Badge variant={ROLE_VARIANT[role] ?? "outline"}>{role.charAt(0).toUpperCase() + role.slice(1)}</Badge>;
            }
        },
        {
            id: "actions",
            size: 160,
            header: () => <p className="column-title">Actions</p>,
            cell: ({ row }) => (
                <div className="flex gap-1">
                    <ShowButton resource="users" recordItemId={row.original.id} variant="outline" size="sm" />
                    <EditButton resource="users" recordItemId={row.original.id} variant="outline" size="sm" />
                    <DeleteButton resource="users" recordItemId={row.original.id} variant="outline" size="sm" />
                </div>
            )
        }
    ], []);

    const table = useTable<User>({
        columns,
        refineCoreProps: {
            resource: "users",
            pagination: { pageSize: 10, mode: "server" },
            filters: { permanent: [...roleFilters, ...searchFilters] },
        }
    });

    return (
        <ListView>
            <Breadcrumb />
            <h1 className="page-title">Users</h1>
            <div className="intro-row">
                <p>Manage all users across the system.</p>
                <div className="actions-row">
                    <div className="search-field">
                        <Search className="search-icon" />
                        <Input type="text" placeholder="Search by name or email..." className="pl-10 w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Filter by role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                                <SelectItem value={UserRole.TEACHER}>Teacher</SelectItem>
                                <SelectItem value={UserRole.STUDENT}>Student</SelectItem>
                            </SelectContent>
                        </Select>
                        <CreateButton resource="users" />
                    </div>
                </div>
            </div>
            <DataTable table={table} />
        </ListView>
    );
};

export default UsersList;
