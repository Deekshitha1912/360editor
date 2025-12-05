export const db = {
    store: (id, blob) => {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open("photosDB", 1);

            req.onupgradeneeded = () => {
                req.result.createObjectStore("photos");
            };

            req.onsuccess = () => {
                const tx = req.result.transaction("photos", "readwrite");
                tx.objectStore("photos").put(blob, id);
                tx.oncomplete = resolve;
            };

            req.onerror = reject;
        });
    },

    get: (id) => {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open("photosDB", 1);

            req.onupgradeneeded = () => {
                req.result.createObjectStore("photos");
            };

            req.onsuccess = () => {
                const tx = req.result.transaction("photos", "readonly");
                const r = tx.objectStore("photos").get(id);
                r.onsuccess = () => resolve(r.result);
                r.onerror = reject;
            };

            req.onerror = reject;
        });
    },
};
