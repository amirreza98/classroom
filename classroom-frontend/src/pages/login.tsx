import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Loader2 } from "lucide-react";

const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginForm) => {
        setError(null);
        const result = await signIn.email({
            email: data.email,
            password: data.password,
        });

        if (result.error) {
            setError(result.error.message ?? "Invalid email or password");
            return;
        }

        navigate("/");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-sm space-y-6">
                <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground">
                        <GraduationCap className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold">Classroom</h1>
                    <p className="text-sm text-muted-foreground">Admin Dashboard</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Sign in</CardTitle>
                        <CardDescription>Enter your credentials to access the dashboard</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <CardContent className="space-y-4">
                            {error && (
                                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    {...register("email")}
                                />
                                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    {...register("password")}
                                />
                                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-3">
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Sign in
                            </Button>
                            <p className="text-sm text-muted-foreground text-center">
                                Don't have an account?{" "}
                                <Link to="/register" className="text-primary hover:underline font-medium">
                                    Register
                                </Link>
                            </p>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}
