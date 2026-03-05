import { useShow } from "@refinedev/core";
import { User } from "@/types";
import { ShowView, ShowViewHeader } from "@/components/refine-ui/views/show-view";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Calendar, Shield } from "lucide-react";

const ROLE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    admin: "destructive",
    teacher: "default",
    student: "secondary",
};

const UsersShow = () => {
    const { query } = useShow<User>({ resource: "users" });
    const user = query.data?.data;
    const { isLoading, isError } = query;

    if (isLoading || isError || !user) {
        return (
            <ShowView>
                <ShowViewHeader resource="users" title="User Details" />
                <p className="state-message">
                    {isLoading ? "Loading user details..." : isError ? "Failed to load user details..." : "User not found"}
                </p>
            </ShowView>
        );
    }

    const initials = user.name.split(" ").slice(0, 2).map(p => p[0]?.toUpperCase()).join("");

    return (
        <ShowView>
            <ShowViewHeader resource="users" title="User Details" />
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        {user.image ? (
                            <img src={user.image} alt={user.name} className="h-20 w-20 rounded-full object-cover" />
                        ) : (
                            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                                {initials}
                            </div>
                        )}
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold">{user.name}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant={ROLE_VARIANT[user.role] ?? "outline"}>
                                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                </Badge>
                                {user.emailVerified && <Badge variant="outline" className="text-green-600 border-green-600">Verified</Badge>}
                            </div>
                        </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Email:</span>
                            <span className="font-medium">{user.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Role:</span>
                            <span className="font-medium capitalize">{user.role}</span>
                        </div>
                        {user.createdAt && (
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Joined:</span>
                                <span className="font-medium">{new Date(user.createdAt).toLocaleDateString()}</span>
                            </div>
                        )}
                        {user.updatedAt && (
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Updated:</span>
                                <span className="font-medium">{new Date(user.updatedAt).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </ShowView>
    );
};

export default UsersShow;
