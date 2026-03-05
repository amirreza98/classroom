import { useShow } from "@refinedev/core";
import { Subject } from "@/types";
import { ShowView, ShowViewHeader } from "@/components/refine-ui/views/show-view";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Building2, Calendar, FileText } from "lucide-react";

const SubjectsShow = () => {
    const { query } = useShow<Subject>({ resource: "subjects" });
    const subject = query.data?.data;
    const { isLoading, isError } = query;

    if (isLoading || isError || !subject) {
        return (
            <ShowView>
                <ShowViewHeader resource="subjects" title="Subject Details" />
                <p className="state-message">
                    {isLoading ? "Loading..." : isError ? "Failed to load subject." : "Subject not found."}
                </p>
            </ShowView>
        );
    }

    return (
        <ShowView>
            <ShowViewHeader resource="subjects" title="Subject Details" />
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                            <Badge variant="outline" className="font-mono text-sm mb-1">{subject.code}</Badge>
                            <h2 className="text-2xl font-bold">{subject.name}</h2>
                        </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {subject.description && (
                            <div className="flex items-start gap-2 text-sm sm:col-span-2">
                                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="text-muted-foreground font-medium mb-1">Description</p>
                                    <p>{subject.description}</p>
                                </div>
                            </div>
                        )}
                        {subject.department && (
                            <div className="flex items-center gap-2 text-sm">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Department:</span>
                                <span className="font-medium">{subject.department.name}</span>
                                <Badge variant="outline" className="text-xs font-mono">{subject.department.code}</Badge>
                            </div>
                        )}
                        {subject.createdAt && (
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Created:</span>
                                <span className="font-medium">{new Date(subject.createdAt).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </ShowView>
    );
};

export default SubjectsShow;
