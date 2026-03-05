import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useBack } from "@refinedev/core";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@refinedev/react-hook-form";
import { userSchema } from "@/lib/schema";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { ShowView, ShowViewHeader } from "@/components/refine-ui/views/show-view";

const UsersEdit = () => {
    const back = useBack();

    const form = useForm<z.infer<typeof userSchema>>({
        resolver: zodResolver(userSchema),
        defaultValues: { name: "", email: "", role: "student" },
        refineCoreProps: { action: "edit", resource: "users" },
    });

    const { refineCore: { onFinish, queryResult }, handleSubmit, formState: { isSubmitting }, control, reset } = form;

    const userData = queryResult?.data?.data;

    useEffect(() => {
        if (userData) {
            reset({
                name: userData.name ?? "",
                email: userData.email ?? "",
                role: userData.role ?? "student",
                image: userData.image ?? undefined,
                imageCldPubId: userData.imageCldPubId ?? undefined,
            });
        }
    }, [userData, reset]);

    const onSubmit = async (values: z.infer<typeof userSchema>) => {
        try {
            await onFinish(values);
        } catch (error) {
            console.error("Error updating user:", error);
        }
    };

    return (
        <ShowView>
            <ShowViewHeader resource="users" title="Edit User" />
            <div className="my-4 flex items-center">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold">Edit User</CardTitle>
                    </CardHeader>
                    <Separator />
                    <CardContent className="mt-6">
                        <Form {...form}>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                                <FormField control={control} name="name" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name <span className="text-orange-600">*</span></FormLabel>
                                        <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={control} name="email" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email Address <span className="text-orange-600">*</span></FormLabel>
                                        <FormControl><Input type="email" placeholder="john@example.com" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={control} name="role" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Role <span className="text-orange-600">*</span></FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="student">Student</SelectItem>
                                                <SelectItem value="teacher">Teacher</SelectItem>
                                                <SelectItem value="admin">Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
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

export default UsersEdit;
