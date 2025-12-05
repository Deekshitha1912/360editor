"use client";

import { useRef, useEffect, useState } from "react";
import { db } from "@/lib/db";
import {useEditor} from "@/context/editor_provider";

export default function EditorLeft() {
    const fileInputRef = useRef(null);
    const { photos, setPhotos, activePhoto, setActivePhoto } = useEditor();
    const [thumbs, setThumbs] = useState({}); // { id: url }

    const handleImport = () => fileInputRef.current?.click();

    const handleFilesSelected = async (e) => {
        let files = Array.from(e.target.files);

        if (photos.length + files.length > 30)
            files = files.slice(0, 30 - photos.length);

        const metaData = [];

        for (const file of files) {
            const id = crypto.randomUUID();
            await db.store(id, file);
            metaData.push({ id, name: file.name });
        }

        setPhotos([...photos, ...metaData]);
    };

    const deletePhoto = (id) => {
        setPhotos((prev) => prev.filter((p) => p.id !== id));

        setThumbs((prev) => {
            const cache = { ...prev };
            delete cache[id];
            return cache;
        });

        if (activePhoto === id) {
            setActivePhoto(null);
        }
        const ls = JSON.parse(localStorage.getItem("photos") || "[]").filter((p) => p.id !== id);
        localStorage.setItem("photos", JSON.stringify(ls));
        // refresh pannellum / UI safely
        setTimeout(() => {
            window.location.reload();
        }, 80);
    };

    const handleDragStart = (id, e) => {
        e.dataTransfer.setData("photo-id", id);
    };

    // Load preview thumbnails (only for left panel)
    useEffect(() => {
        photos.forEach((p) => {
            if (!thumbs[p.id]) {
                db.get(p.id).then((blob) => {
                    const url = URL.createObjectURL(blob);
                    setThumbs((prev) => ({ ...prev, [p.id]: url }));
                });
            }
        });
    }, [photos]);

    return (
        <div className="w-64 border-r p-4">
            <button onClick={handleImport} className="w-full py-3 bg-black text-white rounded-lg">
                Import Photos
            </button>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
            />

            <div className="mt-6 space-y-2 overflow-y-auto max-h-[80vh]">
                {photos.map((p) => (
                    <div key={p.id} draggable onDragStart={(e) => handleDragStart(p.id, e)} className="relative">
                        {thumbs[p.id] && (
                            <img src={thumbs[p.id]} className="w-full rounded shadow" />
                        )}

                        <button
                            onClick={() => deletePhoto(p.id)}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded"
                        >
                            X
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
