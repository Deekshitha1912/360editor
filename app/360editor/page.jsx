"use client";

import { useRef, useState } from "react";

export default function Editor360() {
    const fileInputRef = useRef(null);
    const [photos, setPhotos] = useState([]);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFilesSelected = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const previewFiles = files.map((file) => ({
            file,
            url: URL.createObjectURL(file),
        }));
        setPhotos((prev) => [...prev, ...previewFiles]);
    };

    return (
        <div className="w-full h-screen flex">

            <div className="w-64 border-r p-4">
                <button
                    onClick={handleImportClick}
                    className="w-full py-3 bg-black text-white rounded-lg"
                >
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
                    {photos.map((p, idx) => (
                        <img
                            key={idx}
                            src={p.url}
                            className="w-full rounded shadow"
                            alt=""
                        />
                    ))}
                </div>
            </div>

            <div className="flex-1 p-6">
                <h1 className="text-2xl font-semibold">360 Editor</h1>
            </div>
        </div>
    );
}
