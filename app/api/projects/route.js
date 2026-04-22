import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthenticatedUser, jsonError } from "./_utils";

export async function GET(request) {
    const auth = await getAuthenticatedUser(request);
    if (auth.error) return jsonError(auth.error, auth.status);

    const { data, error } = await supabaseAdmin
        .from("projects")
        .select("id,name,images,created_at,updated_at")
        .eq("user_id", auth.user.id)
        .order("updated_at", { ascending: false });

    if (error) return jsonError(error.message);

    return NextResponse.json({ projects: data || [] });
}

export async function POST(request) {
    const auth = await getAuthenticatedUser(request);
    if (auth.error) return jsonError(auth.error, auth.status);

    const body = await request.json().catch(() => ({}));
    const name =
        body?.name?.trim() || `Panorama project ${new Date().toLocaleDateString()}`;

    const { data, error } = await supabaseAdmin
        .from("projects")
        .insert({
            user_id: auth.user.id,
            name,
            images: [],
            panorama_config: {},
        })
        .select()
        .single();

    if (error) return jsonError(error.message);

    return NextResponse.json({ project: data });
}
