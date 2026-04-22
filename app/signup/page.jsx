"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boxes, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
    const router = useRouter();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);

        const signupResponse = await fetch("/api/signup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                firstName,
                lastName,
                email,
                password,
            }),
        });

        const signupResult = await signupResponse.json();

        if (!signupResponse.ok) {
            toast.error(signupResult.error || "Signup failed.");
            setLoading(false);
            return;
        }

        const loginResponse = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email,
                password,
            }),
        });

        const loginResult = await loginResponse.json();

        if (!loginResponse.ok) {
            toast.error(loginResult.error || "Account created, but login failed.");
            setLoading(false);
            return;
        }

        const { error: sessionError } = await supabase.auth.setSession({
            access_token: loginResult.session.access_token,
            refresh_token: loginResult.session.refresh_token,
        });

        if (sessionError) {
            toast.error(sessionError.message);
            setLoading(false);
            return;
        }

        toast.success("Account created!");
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
                        Create a workspace for immersive image projects.
                    </h1>
                    <p className="mt-5 max-w-lg text-base leading-7 text-white/65">
                        Store imports by user and project, then inspect each image in a 360 viewer.
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-center p-6">
                <Card className="w-full max-w-md border bg-white shadow-sm">
                    <CardHeader>
                        <div className="mb-2 flex size-11 items-center justify-center rounded-md bg-black text-white">
                            <UserPlus className="size-5" />
                        </div>
                        <CardTitle className="text-2xl">Create account</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Set up your 360Editor workspace.
                        </p>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleSignup} className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>First name</Label>
                                    <Input
                                        placeholder="First name"
                                        value={firstName}
                                        disabled={loading}
                                        onChange={(e) => setFirstName(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Last name</Label>
                                    <Input
                                        placeholder="Last name"
                                        value={lastName}
                                        disabled={loading}
                                        onChange={(e) => setLastName(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    disabled={loading}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Password</Label>
                                <Input
                                    type="password"
                                    placeholder="Create a password"
                                    value={password}
                                    disabled={loading}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            <Button
                                type="submit"
                                className="h-11 w-full"
                                disabled={loading || !firstName || !email || !password}
                            >
                                {loading ? "Signing up..." : "Sign Up"}
                            </Button>
                        </form>

                        <div className="text-center text-sm mt-4">
                            Already have an account?{" "}
                            <a href="/login" className="text-blue-600 underline">
                                Login
                            </a>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
