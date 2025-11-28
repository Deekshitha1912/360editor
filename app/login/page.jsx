"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {Card, CardHeader, CardContent, CardTitle} from "@/components/ui/card";
import {supabase} from "@/lib/supabase";
import {useRouter} from "next/navigation";
import {toast} from "sonner";

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        const { data, error } = await supabase.auth.signInWithPassword({email, password,});

        if (error) {
            setLoading(false);
            return;
        }

        toast.success("Login success!", data.user);
        router.push("/dashboard")

        const {data: { user },} = await supabase.auth.getUser();
        console.log("Fetched user from auth.users:", user);
        setLoading(false);
    };

    return (
        <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
            {/* Left Logo */}
            <div className="flex items-center justify-center bg-gray-100">
                <h1 className="text-4xl font-bold">MyLogo</h1>
            </div>

            {/* Right Login */}
            <div className="flex items-center justify-center p-6">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Login</CardTitle>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <Input
                                type="email"
                                placeholder="Email"
                                disabled={loading}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />

                            <Input
                                type="password"
                                placeholder="Password"
                                disabled={loading}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={loading || !email || !password}
                            >
                                {loading ? "Logging in..." : "Login"}
                            </Button>
                            <div className="text-center text-sm">
                                Don’t have an account?{" "}
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
