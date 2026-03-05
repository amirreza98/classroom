import { useShow } from "@refinedev/core";
import { Department } from "@/types";
import { ShowView, ShowViewHeader } from "@/components/refine-ui/views/show-view";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Hash, FileText } from "lucide-react";

const DepartmentsShow = () => {
    const { query } = useShow<Department>({ resource: "departments" });
    const dept = query.data?.data;
    const { isLoading, isError } = query;

    if (isLoading || isError || !dept) {
        return (
            <ShowView>
                <ShowViewHeader resource="departments" title="Department Details" />
                <p className="state-message">
                    {isLoading ? "Loading..." : isError ? "Failed to load department." : "Department not found."}
                </p>
            </ShowView>
        );
    }

    return (
        <ShowView>
            <ShowViewHeader resource="departments" title="Department Details" />
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <Hash className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                            <Badge variant="outline" className="font-mono text-base mb-1">{dept.code}</Badge>
                            <h2 className="text-2xl font-bold">{dept.name}</h2>
                        </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {dept.description && (
                            <div className="flex items-start gap-2 text-sm sm:col-span-2">
                                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="text-muted-foreground font-medium mb-1">Description</p>
                                    <p>{dept.description}</p>
                                </div>
                            </div>
                        )}
                        {dept.createdAt && (
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Created:</span>
                                <span className="font-medium">{new Date(dept.createdAt).toLocaleDateString()}</span>
                            </div>
                        )}
                        {dept.updatedAt && (
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Updated:</span>
                                <span className="font-medium">{new Date(dept.updatedAt).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </ShowView>
    );
};

export default DepartmentsShow;
