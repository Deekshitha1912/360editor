import { NextResponse } from "next/server";
import {
    getAuthenticatedUser,
    getOwnedProject,
    jsonError,
    signProjectImages,
    STORAGE_BUCKET,
    updateProjectImages,
} from "../../_utils";
import { supabaseAdmin } from "@/lib/supabase-admin";

const sanitizeFileName = (name) =>
    name
        .trim()
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-z0-9-_]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "image";

const withExtension = (name, fileName) => {
    const extension = fileName.includes(".") ? fileName.split(".").pop() : "jpg";
    return `${sanitizeFileName(name)}.${extension}`;
};

export async function POST(request, { params }) {
    const auth = await getAuthenticatedUser(request);
    if (auth.error) return jsonError(auth.error, auth.status);

    const { id } = await params;
    const result = await getOwnedProject(id, auth.user.id);
    if (result.error) return jsonError(result.error, result.status);

    const formData = await request.formData();
    const files = formData.getAll("files").filter((file) => file?.size);
    const names = formData.getAll("names");

    if (!files.length) {
        return jsonError("At least one image is required.");
    }

    const existingImages = Array.isArray(result.project.images)
        ? result.project.images
        : [];

    if (existingImages.length + files.length > 30) {
        return jsonError("A project can only contain 30 images.");
    }

    const uploaded = [];

    for (const [index, file] of files.entries()) {
        const imageId = crypto.randomUUID();
        const fallbackName = file.name.replace(/\.[^/.]+$/, "");
        const displayName = `${names[index] || fallbackName}`.trim() || fallbackName;
        const storageName = withExtension(displayName, file.name);
        const path = `${auth.user.id}/${result.project.id}/${imageId}-${storageName}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .upload(path, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type || "image/jpeg",
            });

        if (uploadError) {
            return jsonError(uploadError.message);
        }

        uploaded.push({
            id: imageId,
            name: displayName,
            original_name: file.name,
            path,
            yaw: 0,
            pitch: 0,
            hfov: 150,
            hotSpots: [],
            created_at: new Date().toISOString(),
        });
    }

    const project = await updateProjectImages(result.project, [
        ...existingImages,
        ...uploaded,
    ]);

    return NextResponse.json({
        project: await signProjectImages(project),
    });
}
