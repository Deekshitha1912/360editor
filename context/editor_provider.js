"use client";

import { createContext, useContext, useState, useEffect } from "react";
import {load, save} from "@/lib/storage";

const EditorContext = createContext(null);
export const useEditor = () => useContext(EditorContext);

export default function EditorProvider({ children }) {
    const [photos, setPhotos] = useState([]);
    const [activePhoto, setActivePhoto] = useState(null);

    useEffect(() => {
        setPhotos(load("photos", []));
        setActivePhoto(load("activePhoto", null));
    }, []);

    useEffect(() => save("photos", photos), [photos]);
    useEffect(() => save("activePhoto", activePhoto), [activePhoto]);

    return (
        <EditorContext.Provider value={{ photos, setPhotos, activePhoto, setActivePhoto }}>
            {children}
        </EditorContext.Provider>
    );
}
