"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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

        // 1. Create auth user
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            email_confirm: true,
        });

        if (error) {
            toast.error(error.message);
            setLoading(false);
            return;
        }

        const user = data.user;

        // 2. Insert into profiles table
        const { error: profileError } = await supabase.from("profiles").insert({
            id: user.id,
            first_name: firstName,
            last_name: lastName,
            email: email,
        });

        if (profileError) {
            toast.error(profileError.message);
            setLoading(false);
            return;
        }

        toast.success("Account created!");

        // 3. Supabase already logs user in on signUp (if email confirmation disabled)
        router.push("/dashboard");

        setLoading(false);
    };

    return (
        <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
            <div className="flex items-center justify-center bg-gray-100">
                <h1 className="text-4xl font-bold">MyLogo</h1>
            </div>

            <div className="flex items-center justify-center p-6">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Sign Up</CardTitle>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleSignup} className="space-y-4">
                            <Input
                                placeholder="First Name"
                                value={firstName}
                                disabled={loading}
                                onChange={(e) => setFirstName(e.target.value)}
                            />

                            <Input
                                placeholder="Last Name"
                                value={lastName}
                                disabled={loading}
                                onChange={(e) => setLastName(e.target.value)}
                            />

                            <Input
                                type="email"
                                placeholder="Email"
                                value={email}
                                disabled={loading}
                                onChange={(e) => setEmail(e.target.value)}
                            />

                            <Input
                                type="password"
                                placeholder="Password"
                                value={password}
                                disabled={loading}
                                onChange={(e) => setPassword(e.target.value)}
                            />

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={loading || !email || !password}
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
