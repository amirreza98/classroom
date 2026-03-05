import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useBack, useList } from "@refinedev/core";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@refinedev/react-hook-form";
import { classSchema } from "@/lib/schema";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { ShowView, ShowViewHeader } from "@/components/refine-ui/views/show-view";
import { Subject, User } from "@/types";
import UploadWidget from "@/components/upload-widget";

const ClassesEdit = () => {
    const back = useBack();

    const form = useForm<z.infer<typeof classSchema>>({
        resolver: zodResolver(classSchema),
        defaultValues: { name: "", description: "", subjectId: 0, teacherId: "", capacity: 30, status: "active", bannerUrl: "", bannerCldPubId: "" },
        refineCoreProps: { action: "edit", resource: "classes" },
    });

    const { refineCore: { onFinish, queryResult }, handleSubmit, formState: { isSubmitting, errors }, control, reset, setValue, watch } = form;

    const classData = queryResult?.data?.data;

    const { query: subjectsQuery } = useList<Subject>({ resource: "subjects", pagination: { pageSize: 100 } });
    const { query: teachersQuery } = useList<User>({ resource: "users", filters: [{ field: "role", operator: "eq", value: "teacher" }], pagination: { pageSize: 100 } });

    const subjects = subjectsQuery?.data?.data ?? [];
    const teachers = teachersQuery?.data?.data ?? [];
    const bannerPublicId = watch("bannerCldPubId");

    useEffect(() => {
        if (classData) {
            reset({
                name: classData.name ?? "",
                description: classData.description ?? "",
                subjectId: classData.subjectId ?? classData.subject?.id ?? 0,
                teacherId: classData.teacherId ?? classData.teacher?.id ?? "",
                capacity: classData.capacity ?? 30,
                status: classData.status ?? "active",
                bannerUrl: classData.bannerUrl ?? "",
                bannerCldPubId: classData.bannerCldPubId ?? "",
            });
        }
    }, [classData, reset]);

    const setBannerImage = (field: { onChange: (v: string) => void }, file: { url: string; publicId: string } | null) => {
        if (file) {
            field.onChange(file.url);
            setValue("bannerCldPubId", file.publicId, { shouldValidate: true, shouldDirty: true });
        } else {
            field.onChange("");
            setValue("bannerCldPubId", "", { shouldValidate: true, shouldDirty: true });
        }
    };

    const onSubmit = async (values: z.infer<typeof classSchema>) => {
        try {
            await onFinish(values);
        } catch (error) {
            console.error("Error updating class:", error);
        }
    };

    return (
        <ShowView className="class-view">
            <ShowViewHeader resource="classes" title="Edit Class" />
            <div className="my-4 flex items-center">
                <Card className="class-form-card w-full max-w-2xl">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold text-gradient-orange">Edit Class</CardTitle>
                    </CardHeader>
                    <Separator />
                    <CardContent className="mt-6">
                        <Form {...form}>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                                <FormField control={control} name="bannerUrl" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Banner Image <span className="text-orange-600">*</span></FormLabel>
                                        <FormControl>
                                            <UploadWidget
                                                value={field.value ? { url: field.value, publicId: bannerPublicId ?? "" } : null}
                                                onChange={(file) => setBannerImage(field, file)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                        {errors.bannerCldPubId && !errors.bannerUrl && (
                                            <p className="text-destructive text-sm">{errors.bannerCldPubId.message?.toString()}</p>
                                        )}
                                    </FormItem>
                                )} />

                                <FormField control={control} name="name" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Class Name <span className="text-orange-600">*</span></FormLabel>
                                        <FormControl><Input placeholder="Introduction to Biology - Section A" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <div className="grid sm:grid-cols-2 gap-4">
                                    <FormField control={control} name="subjectId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Subject <span className="text-orange-600">*</span></FormLabel>
                                            <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()} disabled={subjectsQuery.isLoading}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select a subject" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {subjects.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.code})</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="teacherId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Teacher <span className="text-orange-600">*</span></FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value} disabled={teachersQuery.isLoading}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select a teacher" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {teachers.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    <FormField control={control} name="capacity" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Capacity</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="30" onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} value={(field.value as number | undefined) ?? ""} name={field.name} ref={field.ref} onBlur={field.onBlur} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="status" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Status <span className="text-orange-600">*</span></FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="inactive">Inactive</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                <FormField control={control} name="description" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl><Textarea placeholder="Brief description about the class" {...field} /></FormControl>
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

export default ClassesEdit;
