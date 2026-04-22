"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";

export default function EditorLeft({
    photos,
    activePhoto,
    setActivePhoto,
    uploadPhotos,
    deletePhoto,
    uploading,
    loadingProject,
}) {
    const fileInputRef = useRef(null);
    const [photoToDelete, setPhotoToDelete] = useState(null);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [pendingNames, setPendingNames] = useState([]);

    const handleImport = () => fileInputRef.current?.click();

    const handleFilesSelected = (event) => {
        let files = Array.from(event.target.files || []);
        event.target.value = "";

        if (!files.length) return;

        if (photos.length + files.length > 30) {
            files = files.slice(0, 30 - photos.length);
        }

        setPendingFiles(files);
        setPendingNames(files.map((file) => file.name.replace(/\.[^/.]+$/, "")));
    };

    const closeUploadDialog = () => {
        if (uploading) return;
        setPendingFiles([]);
        setPendingNames([]);
    };

    const confirmUpload = async () => {
        const names = pendingNames.map((name, index) => {
            const fallback = pendingFiles[index]?.name.replace(/\.[^/.]+$/, "") || "Image";
            return name.trim() || fallback;
        });

        await uploadPhotos(pendingFiles, names);
        closeUploadDialog();
    };

    const handleDragStart = (id, event) => {
        event.dataTransfer.setData("photo-id", id);
    };

    const handleConfirmDelete = async (yes) => {
        if (yes && photoToDelete) {
            await deletePhoto(photoToDelete.id);
        }

        setPhotoToDelete(null);
    };

    return (
        <>
            <aside className="flex h-full w-80 shrink-0 flex-col border-r bg-white">
                <div className="border-b p-5">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-md bg-black text-white">
                            <ImagePlus className="size-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold">Image Library</h2>
                            <p className="text-sm text-muted-foreground">
                                {photos.length}/30 panoramas
                            </p>
                        </div>
                    </div>

                    <Button
                        onClick={handleImport}
                        disabled={uploading || loadingProject || photos.length >= 30}
                        className="h-11 w-full"
                    >
                        {uploading ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            <UploadCloud />
                        )}
                        {uploading ? "Uploading..." : "Import images"}
                    </Button>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFilesSelected}
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {!photos.length && (
                        <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-md border border-dashed bg-slate-50 p-6 text-center">
                            <UploadCloud className="mb-3 size-8 text-slate-400" />
                            <p className="text-sm font-medium">No images imported</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Upload equirectangular images, then drag one into the viewer.
                            </p>
                        </div>
                    )}

                    <div className="space-y-3">
                        {photos.map((photo) => (
                            <div
                                key={photo.id}
                                draggable
                                onDragStart={(event) => handleDragStart(photo.id, event)}
                                onClick={() => setActivePhoto(photo.id)}
                                className={`group relative cursor-grab overflow-hidden rounded-md border bg-white shadow-sm transition hover:border-slate-400 ${
                                    activePhoto === photo.id ? "border-black ring-2 ring-black/10" : ""
                                }`}
                            >
                                {photo.url ? (
                                    <img
                                        src={photo.url}
                                        alt={photo.name}
                                        className="h-32 w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-32 items-center justify-center bg-slate-100 text-sm text-muted-foreground">
                                        Preview unavailable
                                    </div>
                                )}

                                <div className="flex items-center justify-between gap-2 p-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">{photo.name}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {photo.original_name || "Supabase Storage"}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setPhotoToDelete(photo);
                                        }}
                                    >
                                        <Trash2 />
                                        <span className="sr-only">Delete image</span>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            <ConfirmationDialog
                open={Boolean(photoToDelete)}
                setOpen={(open) => {
                    if (!open) setPhotoToDelete(null);
                }}
                title="Delete image?"
                message={`Delete "${photoToDelete?.name || "this image"}" from this project and Supabase Storage?`}
                onConfirm={handleConfirmDelete}
                requireFeedback={false}
            />

            <Dialog open={Boolean(pendingFiles.length)} onOpenChange={(open) => !open && closeUploadDialog()}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Name images before upload</DialogTitle>
                    </DialogHeader>

                    <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
                        {pendingFiles.map((file, index) => (
                            <div key={`${file.name}-${index}`} className="space-y-2 rounded-md border p-3">
                                <Label htmlFor={`image-name-${index}`}>Image name</Label>
                                <Input
                                    id={`image-name-${index}`}
                                    value={pendingNames[index] || ""}
                                    disabled={uploading}
                                    onChange={(event) => {
                                        const nextNames = [...pendingNames];
                                        nextNames[index] = event.target.value;
                                        setPendingNames(nextNames);
                                    }}
                                />
                                <p className="truncate text-xs text-muted-foreground">{file.name}</p>
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeUploadDialog} disabled={uploading}>
                            Cancel
                        </Button>
                        <Button onClick={confirmUpload} disabled={uploading}>
                            {uploading && <Loader2 className="animate-spin" />}
                            Upload images
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
