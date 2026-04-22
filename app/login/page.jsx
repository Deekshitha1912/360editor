"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boxes, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email,
                password,
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            toast.error(result.error || "Login failed.");
            setLoading(false);
            return;
        }

        const { error } = await supabase.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
        });

        if (error) {
            toast.error(error.message);
            setLoading(false);
            return;
        }

        toast.success("Login successful.");
        router.push("/dashboard");
        setLoading(false);
    };

    return (
        <div className="grid min-h-screen grid-cols-1 bg-slate-50 lg:grid-cols-[1fr_520px]">
            <div className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-white text-slate-950">
                        <Boxes className="size-5" />
                    </div>
                    <div>
                        <p className="text-lg font-semibold">360Editor</p>
                        <p className="text-sm text-white/60">Panorama project studio</p>
                    </div>
                </div>

                <div>
                    <h1 className="max-w-xl text-5xl font-semibold tracking-tight">
                        Review 360 images in a focused production workspace.
                    </h1>
                    <p className="mt-5 max-w-lg text-base leading-7 text-white/65">
                        Sign in to create projects, upload named images to Supabase Storage, and preview panoramas.
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-center p-6">
                <Card className="w-full max-w-md border bg-white shadow-sm">
                    <CardHeader>
                        <div className="mb-2 flex size-11 items-center justify-center rounded-md bg-black text-white">
                            <LogIn className="size-5" />
                        </div>
                        <CardTitle className="text-2xl">Welcome back</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Login to continue to your dashboard.
                        </p>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    placeholder="you@example.com"
                                    disabled={loading}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Password</Label>
                                <Input
                                    type="password"
                                    placeholder="Enter your password"
                                    disabled={loading}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            <Button
                                type="submit"
                                className="h-11 w-full"
                                disabled={loading || !email || !password}
                            >
                                {loading ? "Logging in..." : "Login"}
                            </Button>

                            <div className="text-center text-sm">
                                Don&apos;t have an account?{" "}
                                <a href="/signup" className="text-blue-600 underline">
                                    Sign up
                                </a>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
