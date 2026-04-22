"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Move3D, RotateCw } from "lucide-react";
import { toast } from "sonner";

const directionLabels = {
    left_up: "Left up",
    up: "Up",
    right_up: "Right up",
    left: "Left",
};

const directionImages = {
    left_up: "/images/arrow_left_up.gif",
    up: "/images/arrow_up.gif",
    right_up: "/images/arrow_right_up.gif",
    left: "/images/arrow_left.gif",
};

const createDirectionHotspot = (hotSpotDiv, args) => {
    hotSpotDiv.classList.add("direction-hotspot", `direction-hotspot-${args.direction}`);

    const image = document.createElement("img");
    image.src = args.imageUrl || directionImages[args.direction] || directionImages.up;
    image.alt = args.text || "Direction";
    image.draggable = false;

    hotSpotDiv.appendChild(image);
};

export default function EditorMiddle({
    photos,
    activePhoto,
    setActivePhoto,
    loadingProject,
    addHotspot,
}) {
    const viewerRef = useRef(null);
    const viewerInstance = useRef(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [pannellumReady, setPannellumReady] = useState(false);

    const selectedPhoto = useMemo(
        () => photos.find((photo) => photo.id === activePhoto),
        [activePhoto, photos]
    );

    const handleDrop = (event) => {
        event.preventDefault();
        setIsDragOver(false);

        const direction = event.dataTransfer.getData("hotspot-direction");
        if (direction) {
            if (!selectedPhoto || !viewerInstance.current?.mouseEventToCoords) {
                toast.error("Select a panorama before placing a direction.");
                return;
            }

            const [pitch, yaw] = viewerInstance.current.mouseEventToCoords(event);
            const centrePitch = viewerInstance.current.getPitch?.() ?? 0;
            const centreYaw = viewerInstance.current.getYaw?.() ?? 0;

            addHotspot(selectedPhoto.id, {
                id: crypto.randomUUID(),
                pitch: Number(pitch.toFixed(2)),
                yaw: Number(yaw.toFixed(2)),
                "Centre Pitch": Number(centrePitch.toFixed(2)),
                "Centre Yaw": Number(centreYaw.toFixed(2)),
                type: "custom",
                text: directionLabels[direction],
                direction,
                imageUrl: directionImages[direction],
                cssClass: `direction-hotspot direction-hotspot-${direction}`,
                created_at: new Date().toISOString(),
            });
            return;
        }

        const id = event.dataTransfer.getData("photo-id");
        if (id) setActivePhoto(id);
    };

    useEffect(() => {
        const checkPannellum = () => setPannellumReady(Boolean(window.pannellum));
        checkPannellum();

        if (window.pannellum) return;

        const timer = window.setInterval(checkPannellum, 250);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!viewerRef.current || !selectedPhoto?.url || !pannellumReady) return;

        if (viewerInstance.current?.destroy) {
            viewerInstance.current.destroy();
        }

        viewerRef.current.innerHTML = "";
        viewerInstance.current = window.pannellum.viewer(viewerRef.current, {
            type: "equirectangular",
            panorama: selectedPhoto.url,
            autoLoad: true,
            autoRotate: -1,
            showControls: false,
            showZoomCtrl: false,
            compass: true,
            hfov: selectedPhoto.hfov || 150,
            yaw: selectedPhoto.yaw || 0,
            pitch: selectedPhoto.pitch || 0,
            hotSpots: (selectedPhoto.hotSpots || []).map((hotspot) => ({
                ...hotspot,
                createTooltipFunc: createDirectionHotspot,
                createTooltipArgs: {
                    direction: hotspot.direction,
                    text: hotspot.text,
                    imageUrl: hotspot.imageUrl,
                },
            })),
        });

        return () => {
            if (viewerInstance.current?.destroy) {
                viewerInstance.current.destroy();
            }
        };
    }, [selectedPhoto, pannellumReady]);

    return (
        <main
            className={`relative flex min-w-0 flex-1 bg-slate-950 ${
                isDragOver ? "ring-4 ring-inset ring-emerald-400" : ""
            }`}
            onDrop={handleDrop}
            onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
        >
            <div ref={viewerRef} className="h-full w-full" />

            {!selectedPhoto && (
                <div className="absolute inset-6 flex items-center justify-center rounded-md border border-dashed border-white/20 bg-white/[0.03] text-center text-white">
                    <div className="max-w-sm px-6">
                        <Move3D className="mx-auto mb-4 size-10 text-emerald-300" />
                        <h2 className="text-xl font-semibold">
                            {loadingProject ? "Opening project..." : "Drop a panorama here"}
                        </h2>
                        <p className="mt-2 text-sm text-white/65">
                            Select or drag an imported image from the library to preview it as a 360 view.
                        </p>
                    </div>
                </div>
            )}

            {selectedPhoto && (
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-md bg-black/70 px-3 py-2 text-sm text-white backdrop-blur">
                    <RotateCw className="size-4 text-emerald-300" />
                    <span className="max-w-72 truncate">{selectedPhoto.name}</span>
                </div>
            )}
        </main>
    );
}
