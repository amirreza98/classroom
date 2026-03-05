import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useBack, useList } from "@refinedev/core";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@refinedev/react-hook-form";
import { subjectSchema } from "@/lib/schema";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { ShowView, ShowViewHeader } from "@/components/refine-ui/views/show-view";
import { Department } from "@/types";

const SubjectsEdit = () => {
    const back = useBack();

    const form = useForm<z.infer<typeof subjectSchema>>({
        resolver: zodResolver(subjectSchema),
        defaultValues: { name: "", code: "", description: "", departmentId: 0 },
        refineCoreProps: { action: "edit", resource: "subjects" },
    });

    const { refineCore: { onFinish, queryResult }, handleSubmit, formState: { isSubmitting }, control, reset } = form;

    const subjectData = queryResult?.data?.data;

    const { query: deptsQuery } = useList<Department>({ resource: "departments", pagination: { pageSize: 100 } });
    const departments = deptsQuery?.data?.data ?? [];

    useEffect(() => {
        if (subjectData) {
            reset({
                name: subjectData.name ?? "",
                code: subjectData.code ?? "",
                description: subjectData.description ?? "",
                departmentId: subjectData.departmentId ?? subjectData.department?.id ?? 0,
            });
        }
    }, [subjectData, reset]);

    const onSubmit = async (values: z.infer<typeof subjectSchema>) => {
        try {
            await onFinish(values);
        } catch (error) {
            console.error("Error updating subject:", error);
        }
    };

    return (
        <ShowView>
            <ShowViewHeader resource="subjects" title="Edit Subject" />
            <div className="my-4 flex items-center">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold">Edit Subject</CardTitle>
                    </CardHeader>
                    <Separator />
                    <CardContent className="mt-6">
                        <Form {...form}>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <FormField control={control} name="name" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Subject Name <span className="text-orange-600">*</span></FormLabel>
                                            <FormControl><Input placeholder="Introduction to Biology" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="code" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Subject Code <span className="text-orange-600">*</span></FormLabel>
                                            <FormControl><Input placeholder="BIO101" {...field} className="uppercase" onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <FormField control={control} name="departmentId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Department <span className="text-orange-600">*</span></FormLabel>
                                        <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {departments.map(dept => (
                                                    <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name} ({dept.code})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={control} name="description" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl><Textarea placeholder="Brief description..." {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <Separator />
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" onClick={() => back()}>Cancel</Button>
                                    <Button type="submit" size="lg" className="flex-1" disabled={isSubmitting}>
                                        {isSubmitting ? <><span>Saving...</span><Loader2 className="inline-block ml-2 animate-spin" /></> : "Save Changes"}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </ShowView>
    );
};

export default SubjectsEdit;
