"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import EditorLeft from "@/components/360editor/left/import_images";
import EditorMiddle from "@/components/360editor/middle/editor";
import EditorRight from "@/components/360editor/right/directions";
import { supabase } from "@/lib/supabase";

export default function EditorPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params?.id;
    const [project, setProject] = useState(null);
    const [photos, setPhotos] = useState([]);
    const [activePhoto, setActivePhoto] = useState(null);
    const [loadingProject, setLoadingProject] = useState(true);
    const [uploading, setUploading] = useState(false);

    const activePhotoExists = useMemo(
        () => photos.some((photo) => photo.id === activePhoto),
        [activePhoto, photos]
    );

    const getAuthHeaders = useCallback(async () => {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;

        if (!token) {
            router.push("/login");
            return null;
        }

        return {
            Authorization: `Bearer ${token}`,
        };
    }, [router]);

    const applyProject = useCallback((nextProject) => {
        const nextPhotos = Array.isArray(nextProject?.images) ? nextProject.images : [];
        setProject(nextProject);
        setPhotos(nextPhotos);
        setActivePhoto((current) => {
            if (current && nextPhotos.some((photo) => photo.id === current)) {
                return current;
            }

            return nextPhotos[0]?.id || null;
        });
    }, []);

    const loadProject = useCallback(async () => {
        if (!projectId) return;

        setLoadingProject(true);
        const headers = await getAuthHeaders();
        if (!headers) return;

        const response = await fetch(`/api/projects/${projectId}`, { headers });
        const result = await response.json();
        setLoadingProject(false);

        if (!response.ok) {
            toast.error(result.error || "Unable to open this project.");
            router.push("/dashboard");
            return;
        }

        applyProject(result.project);
    }, [applyProject, getAuthHeaders, projectId, router]);

    useEffect(() => {
        loadProject();
    }, [loadProject]);

    useEffect(() => {
        if (!activePhotoExists && photos.length) {
            setActivePhoto(photos[0].id);
        }
    }, [activePhotoExists, photos]);

    const patchProject = async (body, successMessage) => {
        const headers = await getAuthHeaders();
        if (!headers) return false;

        const response = await fetch(`/api/projects/${projectId}`, {
            method: "PATCH",
            headers: {
                ...headers,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        const result = await response.json();

        if (!response.ok) {
            toast.error(result.error || "Unable to save project.");
            return false;
        }

        applyProject(result.project);
        if (successMessage) toast.success(successMessage);
        return true;
    };

    const uploadPhotos = async (files, names) => {
        const headers = await getAuthHeaders();
        if (!headers) return;

        const formData = new FormData();
        files.forEach((file, index) => {
            formData.append("files", file);
            formData.append("names", names[index] || file.name.replace(/\.[^/.]+$/, ""));
        });

        setUploading(true);
        const response = await fetch(`/api/projects/${projectId}/images`, {
            method: "POST",
            headers,
            body: formData,
        });
        const result = await response.json();
        setUploading(false);

        if (!response.ok) {
            toast.error(result.error || "Unable to upload images.");
            return;
        }

        applyProject(result.project);
        toast.success("Images uploaded.");
    };

    const deletePhoto = async (photoId) => {
        await patchProject({ action: "deleteImage", photoId }, "Image deleted.");
    };

    const clearProject = async () => {
        const cleared = await patchProject({ action: "clearImages" }, "Project images cleared.");
        if (cleared) router.push("/dashboard");
    };

    const updateProjectName = async (name) =>
        patchProject({ action: "rename", name }, "Project name saved.");

    const addHotspot = async (photoId, hotspot) =>
        patchProject({ action: "addHotspot", photoId, hotspot }, "Direction hotspot saved.");

    const updateHotspot = async (photoId, hotspot) =>
        patchProject({ action: "updateHotspot", photoId, hotspot }, "Direction hotspot updated.");

    const deleteHotspot = async (photoId, hotspotId) =>
        patchProject({ action: "deleteHotspot", photoId, hotspotId }, "Direction hotspot deleted.");

    return (
        <div className="flex h-screen w-full overflow-hidden bg-white">
            <EditorLeft
                photos={photos}
                activePhoto={activePhoto}
                setActivePhoto={setActivePhoto}
                uploadPhotos={uploadPhotos}
                deletePhoto={deletePhoto}
                uploading={uploading}
                loadingProject={loadingProject}
            />
            <EditorMiddle
                photos={photos}
                activePhoto={activePhoto}
                setActivePhoto={setActivePhoto}
                loadingProject={loadingProject}
                addHotspot={addHotspot}
            />
            <EditorRight
                project={project}
                photos={photos}
                activePhoto={activePhoto}
                setActivePhoto={setActivePhoto}
                clearProject={clearProject}
                updateProjectName={updateProjectName}
                updateHotspot={updateHotspot}
                deleteHotspot={deleteHotspot}
            />
        </div>
    );
}
