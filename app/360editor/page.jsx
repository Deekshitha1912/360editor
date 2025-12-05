"use client";
import EditorLeft from "@/components/360editor/left/import_images";
import EditorMiddle from "@/components/360editor/middle/editor";
import EditorRight from "@/components/360editor/right/directions";
import EditorProvider from "@/context/editor_provider";

export default function EditorPage() {
    return (
        <EditorProvider>
            <div className="w-full h-screen flex">
                <EditorLeft />
                <EditorMiddle />
                <EditorRight />
            </div>
        </EditorProvider>
    );
}
