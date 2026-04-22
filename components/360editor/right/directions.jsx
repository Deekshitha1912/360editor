"use client";

import { useState } from "react";
import {
    ArrowDownToLine,
    Compass,
    Images,
    Loader2,
    MousePointer2,
    Pencil,
    Save,
    Trash2,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";

const steps = [
    {
        icon: Images,
        title: "Import",
        text: "Add desktop images and give each one a project name.",
    },
    {
        icon: ArrowDownToLine,
        title: "Drop",
        text: "Drag a library image into the center viewport.",
    },
    {
        icon: Compass,
        title: "Review",
        text: "Pan, zoom, and inspect the 360 panorama.",
    },
];

export default function EditorRight({
    project,
    photos,
    activePhoto,
    setActivePhoto,
    clearProject,
    updateProjectName,
    updateHotspot,
    deleteHotspot,
}) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [projectName, setProjectName] = useState(project?.name || "");
    const [savingName, setSavingName] = useState(false);
    const [editingHotspot, setEditingHotspot] = useState(null);
    const [draftDirection, setDraftDirection] = useState("");
    const [savingHotspot, setSavingHotspot] = useState(false);

    const selectedPhoto = photos.find((photo) => photo.id === activePhoto);
    const directionTools = [
        { id: "left_up", label: "Left up", image: "/images/arrow_left_up.gif" },
        { id: "up", label: "Up", image: "/images/arrow_up.gif" },
        { id: "right_up", label: "Right up", image: "/images/arrow_right_up.gif" },
        { id: "left", label: "Left", image: "/images/arrow_left.gif" },
    ];

    const handleConfirm = async (yes) => {
        if (!yes) return;
        await clearProject();
    };

    const startEditingName = () => {
        setProjectName(project?.name || "Untitled panorama");
        setEditingName(true);
    };

    const cancelEditingName = () => {
        setProjectName(project?.name || "");
        setEditingName(false);
    };

    const saveProjectName = async () => {
        setSavingName(true);
        const saved = await updateProjectName(projectName);
        setSavingName(false);

        if (saved) {
            setEditingName(false);
        }
    };

    const startEditingHotspot = (hotspot) => {
        setEditingHotspot(hotspot.id);
        setDraftDirection(hotspot.direction || directionTools[0].id);
    };

    const cancelEditingHotspot = () => {
        setEditingHotspot(null);
        setDraftDirection("");
    };

    const saveHotspot = async (hotspot) => {
        const tool = directionTools.find((item) => item.id === draftDirection);
        if (!selectedPhoto || !tool) return;

        setSavingHotspot(true);
        const saved = await updateHotspot(selectedPhoto.id, {
            ...hotspot,
            text: tool.label,
            direction: tool.id,
            imageUrl: tool.image,
            cssClass: `direction-hotspot direction-hotspot-${tool.id}`,
        });
        setSavingHotspot(false);

        if (saved) cancelEditingHotspot();
    };

    return (
        <>
            <aside className="flex h-full w-80 shrink-0 flex-col border-l bg-slate-50">
                <div className="border-b bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Current project
                    </p>
                    {editingName ? (
                        <div className="mt-2 space-y-3">
                            <Input
                                value={projectName}
                                onChange={(event) => setProjectName(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") saveProjectName();
                                    if (event.key === "Escape") cancelEditingName();
                                }}
                                disabled={savingName}
                                autoFocus
                                className="h-10"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={cancelEditingName}
                                    disabled={savingName}
                                >
                                    <X />
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={saveProjectName}
                                    disabled={savingName || !projectName.trim()}
                                >
                                    {savingName ? <Loader2 className="animate-spin" /> : <Save />}
                                    Save
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-1 flex items-center gap-2">
                            <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">
                                {project?.name || "Untitled panorama"}
                            </h2>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={startEditingName}
                                disabled={!project}
                            >
                                <Pencil />
                                <span className="sr-only">Edit project name</span>
                            </Button>
                        </div>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">
                        {photos.length} imported image{photos.length === 1 ? "" : "s"}
                    </p>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-5">
                    <section>
                        <h3 className="text-sm font-semibold">Directions</h3>
                        <div className="mt-3 space-y-3">
                            {steps.map((step) => (
                                <div key={step.title} className="rounded-md border bg-white p-3">
                                    <div className="flex items-center gap-2">
                                        <step.icon className="size-4 text-emerald-600" />
                                        <p className="text-sm font-medium">{step.title}</p>
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                        {step.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-md border bg-white p-4">
                        <h3 className="text-sm font-semibold">Direction arrows</h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Drag an arrow onto the panorama to save its pitch and yaw.
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            {directionTools.map((tool) => (
                                <button
                                    key={tool.id}
                                    type="button"
                                    draggable
                                    onDragStart={(event) => {
                                        event.dataTransfer.setData("hotspot-direction", tool.id);
                                        event.dataTransfer.effectAllowed = "copy";
                                    }}
                                    className="flex cursor-grab items-center justify-center gap-2 rounded-md border bg-slate-50 px-3 py-3 text-sm font-medium transition hover:border-slate-400 hover:bg-white"
                                >
                                    <img
                                        src={tool.image}
                                        alt=""
                                        className="size-8 object-contain"
                                        draggable={false}
                                    />
                                    <span>{tool.label}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-md border bg-white p-4">
                        <div className="mb-3 flex items-center gap-2">
                            <MousePointer2 className="size-4 text-slate-600" />
                            <h3 className="text-sm font-semibold">Selection</h3>
                        </div>

                        {selectedPhoto ? (
                            <div className="space-y-3">
                                <div>
                                    <p className="truncate text-sm font-medium">{selectedPhoto.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {selectedPhoto.original_name || selectedPhoto.path}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => setActivePhoto(null)}
                                >
                                    Clear selection
                                </Button>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No image selected. Click or drag one from the library.
                            </p>
                        )}
                    </section>

                    {selectedPhoto && (
                        <section className="rounded-md border bg-white p-4">
                            <h3 className="text-sm font-semibold">Saved hotspots</h3>
                            {(selectedPhoto.hotSpots || []).length ? (
                                <div className="mt-3 space-y-2">
                                    {(selectedPhoto.hotSpots || []).map((hotspot) => (
                                        <div
                                            key={hotspot.id}
                                            className="rounded-md border bg-slate-50 p-3"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    {editingHotspot === hotspot.id ? (
                                                        <div className="space-y-3">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {directionTools.map((tool) => (
                                                                    <button
                                                                        key={tool.id}
                                                                        type="button"
                                                                        onClick={() => setDraftDirection(tool.id)}
                                                                        disabled={savingHotspot}
                                                                        className={`flex h-16 items-center justify-center rounded-md border bg-white p-2 transition ${
                                                                            draftDirection === tool.id
                                                                                ? "border-black ring-2 ring-black/10"
                                                                                : "hover:border-slate-400"
                                                                        }`}
                                                                    >
                                                                        <img
                                                                            src={tool.image}
                                                                            alt={tool.label}
                                                                            className="size-9 object-contain"
                                                                        />
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={cancelEditingHotspot}
                                                                    disabled={savingHotspot}
                                                                >
                                                                    <X />
                                                                    Cancel
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => saveHotspot(hotspot)}
                                                                    disabled={savingHotspot}
                                                                >
                                                                    {savingHotspot ? (
                                                                        <Loader2 className="animate-spin" />
                                                                    ) : (
                                                                        <Save />
                                                                    )}
                                                                    Save
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-center gap-2">
                                                                <img
                                                                    src={hotspot.imageUrl || directionTools.find((tool) => tool.id === hotspot.direction)?.image}
                                                                    alt=""
                                                                    className="size-9 shrink-0 object-contain"
                                                                />
                                                                <p className="truncate text-sm font-medium">
                                                                    {hotspot.text}
                                                                </p>
                                                            </div>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                pitch {hotspot.pitch}, yaw {hotspot.yaw}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                centre pitch {hotspot["Centre Pitch"]}, centre yaw {hotspot["Centre Yaw"]}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                                {editingHotspot !== hotspot.id && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        className="shrink-0"
                                                        onClick={() => startEditingHotspot(hotspot)}
                                                    >
                                                        <Pencil />
                                                        <span className="sr-only">Edit hotspot</span>
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                    onClick={() => deleteHotspot(selectedPhoto.id, hotspot.id)}
                                                >
                                                    <Trash2 />
                                                    <span className="sr-only">Delete hotspot</span>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    No directions placed on this image yet.
                                </p>
                            )}
                        </section>
                    )}
                </div>

                <div className="border-t bg-white p-5">
                    <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => setConfirmOpen(true)}
                        disabled={!photos.length}
                    >
                        <Trash2 />
                        Discard editing
                    </Button>
                </div>
            </aside>

            <ConfirmationDialog
                open={confirmOpen}
                setOpen={setConfirmOpen}
                title="Discard all images?"
                message="This will delete the imported images from this project and remove them from Supabase Storage."
                onConfirm={handleConfirm}
                requireFeedback={false}
            />
        </>
    );
}
