import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(request) {
    try {
        const body = await request.json();
        const email = body?.email?.trim().toLowerCase();
        const password = body?.password;

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required." },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseServer.auth.signInWithPassword({
            email,
            password,
        });

        if (error || !data?.session || !data?.user) {
            return NextResponse.json(
                { error: error?.message || "Invalid email or password." },
                { status: 401 }
            );
        }

        return NextResponse.json({
            message: "Login successful.",
            session: data.session,
            user: data.user,
        });
    } catch {
        return NextResponse.json(
            { error: "Invalid login request." },
            { status: 400 }
        );
    }
}
