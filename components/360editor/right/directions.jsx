"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useEditor } from "@/context/editor_provider";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import {useRouter} from "next/navigation";

export default function EditorRight() {
    const router = useRouter();
    const { activePhoto, setActivePhoto, setPhotos } = useEditor();
    const [confirmOpen, setConfirmOpen] = useState(false);

    const discardAll = () => {
        setPhotos([]);
        setActivePhoto(null);
        localStorage.removeItem("photos");
        localStorage.removeItem("activePhoto");
        indexedDB.deleteDatabase("photosDB");
        router.push("/dashboard");
    };

    const handleConfirm = (yes) => {
        if (yes) discardAll();
    };

    return (
        <>
            <div className="w-64 p-4 border-l space-y-4">
                <button
                    onClick={() => setConfirmOpen(true)}
                    className="cursor-pointer w-full flex items-center justify-center gap-2 p-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                    <Trash2 size={18} /> Discard Editing
                </button>

                <h2 className="font-semibold pt-4">Controls</h2>

                {!activePhoto && <p>No photo selected</p>}

                {activePhoto && (
                    <div className="space-y-2">
                        <button className="w-full p-2 border">Left</button>
                        <button className="w-full p-2 border">Right</button>
                        <button className="w-full p-2 border">Top</button>
                        <button className="w-full p-2 border">Bottom</button>
                    </div>
                )}
            </div>

            <ConfirmationDialog
                open={confirmOpen}
                setOpen={setConfirmOpen}
                title="Discard All Changes?"
                message="Are you sure you want to discard all images and reset the editor? This action cannot be undone."
                onConfirm={handleConfirm}
                requireFeedback={false}
            />
        </>
    );
}
