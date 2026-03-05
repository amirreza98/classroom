import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useBack } from "@refinedev/core";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@refinedev/react-hook-form";
import { departmentSchema } from "@/lib/schema";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { ShowView, ShowViewHeader } from "@/components/refine-ui/views/show-view";

const DepartmentsEdit = () => {
    const back = useBack();

    const form = useForm<z.infer<typeof departmentSchema>>({
        resolver: zodResolver(departmentSchema),
        defaultValues: { code: "", name: "", description: "" },
        refineCoreProps: { action: "edit", resource: "departments" },
    });

    const { refineCore: { onFinish, queryResult }, handleSubmit, formState: { isSubmitting }, control, reset } = form;

    const deptData = queryResult?.data?.data;

    useEffect(() => {
        if (deptData) {
            reset({
                code: deptData.code ?? "",
                name: deptData.name ?? "",
                description: deptData.description ?? "",
            });
        }
    }, [deptData, reset]);

    const onSubmit = async (values: z.infer<typeof departmentSchema>) => {
        try {
            await onFinish(values);
        } catch (error) {
            console.error("Error updating department:", error);
        }
    };

    return (
        <ShowView>
            <ShowViewHeader resource="departments" title="Edit Department" />
            <div className="my-4 flex items-center">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold">Edit Department</CardTitle>
                    </CardHeader>
                    <Separator />
                    <CardContent className="mt-6">
                        <Form {...form}>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <FormField control={control} name="code" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Code <span className="text-orange-600">*</span></FormLabel>
                                            <FormControl><Input placeholder="CS" {...field} className="uppercase" onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="name" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name <span className="text-orange-600">*</span></FormLabel>
                                            <FormControl><Input placeholder="Computer Science" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
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

export default DepartmentsEdit;
