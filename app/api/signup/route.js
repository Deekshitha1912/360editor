import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request) {
    try {
        const body = await request.json();
        const firstName = body?.firstName?.trim();
        const lastName = body?.lastName?.trim();
        const email = body?.email?.trim().toLowerCase();
        const password = body?.password;

        if (!firstName || !email || !password) {
            return NextResponse.json(
                { error: "First name, email, and password are required." },
                { status: 400 }
            );
        }

        const { data: authData, error: authError } =
            await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    first_name: firstName,
                    last_name: lastName || null,
                    full_name: [firstName, lastName].filter(Boolean).join(" "),
                },
            });

        if (authError || !authData?.user) {
            return NextResponse.json(
                { error: authError?.message || "Unable to create user." },
                { status: 400 }
            );
        }

        const user = authData.user;
        const { error: profileError } = await supabaseAdmin.from("profiles").insert({
            id: user.id,
            first_name: firstName,
            last_name: lastName || null,
            email,
        });

        if (profileError) {
            await supabaseAdmin.auth.admin.deleteUser(user.id);

            return NextResponse.json(
                { error: profileError.message },
                { status: 400 }
            );
        }

        return NextResponse.json({
            message: "Account created successfully.",
            user: {
                id: user.id,
                email: user.email,
            },
        });
    } catch {
        return NextResponse.json(
            { error: "Invalid signup request." },
            { status: 400 }
        );
    }
}
