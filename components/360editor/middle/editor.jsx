"use client";
import {useEditor} from "@/context/editor_provider";
import { useEffect, useRef } from "react";
import { db } from "@/lib/db";

export default function EditorMiddle() {
    const { activePhoto, setActivePhoto, photos } = useEditor();
    const viewerRef = useRef(null);

    const handleDrop = (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("photo-id");
        setActivePhoto(id);
    };

    const handleDragOver = (e) => e.preventDefault();

    useEffect(() => {
        if (!activePhoto) return;

        db.get(activePhoto).then((blob) => {
            const url = URL.createObjectURL(blob);

            viewerRef.current.innerHTML = "";

            pannellum.viewer(viewerRef.current, {
                type: "equirectangular",
                panorama: url,
                hotSpotDebug: true,
                autoLoad: true,
                autoRotate: -1,
                showZoomCtrl: true,
                compass: true,
                hfov: 110,
            });
        });
    }, [activePhoto]);

    return (
        <div
            className="flex-1 p-0 border-x flex"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <div ref={viewerRef} className="w-full h-full flex items-center justify-center">
                {!activePhoto && <p className="text-gray-500">Drag photo here</p>}
            </div>
        </div>
    );
}
