import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const STORAGE_BUCKET = "project-images";

export const jsonError = (message, status = 400) =>
    NextResponse.json({ error: message }, { status });

export const getBearerToken = (request) => {
    const header = request.headers.get("authorization") || "";
    return header.startsWith("Bearer ") ? header.slice(7) : "";
};

export const getAuthenticatedUser = async (request) => {
    const token = getBearerToken(request);

    if (!token) {
        return { error: "Missing authorization token.", status: 401 };
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
        return { error: "Invalid authorization token.", status: 401 };
    }

    return { user: data.user };
};

export const getOwnedProject = async (projectId, userId) => {
    const { data, error } = await supabaseAdmin
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", userId)
        .single();

    if (error || !data) {
        return { error: "Project not found.", status: 404 };
    }

    return { project: data };
};

export const buildPanoramaConfig = (photos, projectName) => {
    const scenes = {};

    photos.forEach((photo) => {
        scenes[photo.id] = {
            title: photo.name,
            panorama: photo.path,
            yaw: photo.yaw ?? 0,
            pitch: photo.pitch ?? 0,
            hfov: photo.hfov ?? 150,
            preload: true,
            hotSpots: photo.hotSpots || [],
        };
    });

    return {
        default: {
            firstScene: photos[0]?.id || "",
            sceneFadeDuration: 1000,
            autoLoad: true,
            showControls: false,
            autoRotate: -3,
            title: projectName || "Untitled panorama",
        },
        scenes,
    };
};

export const signProjectImages = async (project) => {
    const images = Array.isArray(project?.images) ? project.images : [];

    const signedImages = await Promise.all(
        images.map(async (image) => {
            if (!image.path) return image;

            const { data } = await supabaseAdmin.storage
                .from(STORAGE_BUCKET)
                .createSignedUrl(image.path, 60 * 60);

            return {
                ...image,
                url: data?.signedUrl || "",
            };
        })
    );

    return {
        ...project,
        images: signedImages,
    };
};

export const updateProjectImages = async (project, photos) => {
    const images = photos.map(({ url, ...image }) => image);
    const { data, error } = await supabaseAdmin
        .from("projects")
        .update({
            images,
            panorama_config: buildPanoramaConfig(images, project.name),
            updated_at: new Date().toISOString(),
        })
        .eq("id", project.id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};
