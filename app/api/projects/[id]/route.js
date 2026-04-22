import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
    buildPanoramaConfig,
    getAuthenticatedUser,
    getOwnedProject,
    jsonError,
    signProjectImages,
    STORAGE_BUCKET,
    updateProjectImages,
} from "../_utils";

export async function GET(request, { params }) {
    const auth = await getAuthenticatedUser(request);
    if (auth.error) return jsonError(auth.error, auth.status);

    const { id } = await params;
    const result = await getOwnedProject(id, auth.user.id);
    if (result.error) return jsonError(result.error, result.status);

    return NextResponse.json({
        project: await signProjectImages(result.project),
    });
}

export async function PATCH(request, { params }) {
    const auth = await getAuthenticatedUser(request);
    if (auth.error) return jsonError(auth.error, auth.status);

    const { id } = await params;
    const result = await getOwnedProject(id, auth.user.id);
    if (result.error) return jsonError(result.error, result.status);

    const project = result.project;
    const body = await request.json();
    const action = body?.action;
    const photos = Array.isArray(project.images) ? project.images : [];

    if (action === "rename") {
        const name = body?.name?.trim();
        if (!name) return jsonError("Project name is required.");

        const { data, error } = await supabaseAdmin
            .from("projects")
            .update({
                name,
                panorama_config: buildPanoramaConfig(photos, name),
                updated_at: new Date().toISOString(),
            })
            .eq("id", project.id)
            .select()
            .single();

        if (error) return jsonError(error.message);

        return NextResponse.json({
            project: await signProjectImages(data),
        });
    }

    if (action === "addHotspot") {
        const photoId = body?.photoId;
        const hotspot = body?.hotspot;

        if (!photoId || !hotspot?.id) {
            return jsonError("Photo id and hotspot are required.");
        }

        const nextPhotos = photos.map((photo) =>
            photo.id === photoId
                ? { ...photo, hotSpots: [...(photo.hotSpots || []), hotspot] }
                : photo
        );

        const data = await updateProjectImages(project, nextPhotos);
        return NextResponse.json({
            project: await signProjectImages(data),
        });
    }

    if (action === "updateHotspot") {
        const photoId = body?.photoId;
        const hotspot = body?.hotspot;

        if (!photoId || !hotspot?.id) {
            return jsonError("Photo id and hotspot are required.");
        }

        const nextPhotos = photos.map((photo) =>
            photo.id === photoId
                ? {
                      ...photo,
                      hotSpots: (photo.hotSpots || []).map((item) =>
                          item.id === hotspot.id ? hotspot : item
                      ),
                  }
                : photo
        );

        const data = await updateProjectImages(project, nextPhotos);
        return NextResponse.json({
            project: await signProjectImages(data),
        });
    }

    if (action === "deleteHotspot") {
        const photoId = body?.photoId;
        const hotspotId = body?.hotspotId;

        if (!photoId || !hotspotId) {
            return jsonError("Photo id and hotspot id are required.");
        }

        const nextPhotos = photos.map((photo) =>
            photo.id === photoId
                ? {
                      ...photo,
                      hotSpots: (photo.hotSpots || []).filter(
                          (hotspot) => hotspot.id !== hotspotId
                      ),
                  }
                : photo
        );

        const data = await updateProjectImages(project, nextPhotos);
        return NextResponse.json({
            project: await signProjectImages(data),
        });
    }

    if (action === "deleteImage") {
        const photoId = body?.photoId;
        const photo = photos.find((item) => item.id === photoId);

        if (!photo) return jsonError("Image not found.", 404);

        if (photo.path) {
            const { error } = await supabaseAdmin.storage
                .from(STORAGE_BUCKET)
                .remove([photo.path]);

            if (error) return jsonError(error.message);
        }

        const nextPhotos = photos.filter((item) => item.id !== photoId);
        const data = await updateProjectImages(project, nextPhotos);

        return NextResponse.json({
            project: await signProjectImages(data),
        });
    }

    if (action === "clearImages") {
        const paths = photos.map((photo) => photo.path).filter(Boolean);

        if (paths.length) {
            const { error } = await supabaseAdmin.storage
                .from(STORAGE_BUCKET)
                .remove(paths);

            if (error) return jsonError(error.message);
        }

        const data = await updateProjectImages(project, []);

        return NextResponse.json({
            project: await signProjectImages(data),
        });
    }

    return jsonError("Unsupported project action.");
}
