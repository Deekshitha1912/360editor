"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function ConfirmationDialog({ open, setOpen, title = "Confirm", message, onConfirm, requireFeedback = false }) {
    const [feedback, setFeedback] = useState("");

    const handleYes = () => {
        setOpen(false);
        onConfirm(true, feedback);
    };

    const handleNo = () => {
        setOpen(false);
        onConfirm(false, feedback);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="p-0 overflow-hidden rounded-lg">
                <DialogHeader className="bg-gray-50 p-4 border-b font-goldman font-bold">
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>

                <div className="bg-white p-4 text-sm text-gray-700 space-y-4">
                    <p className="font-inter font-light">{message}</p>
                    {requireFeedback && (
                        <Textarea
                            placeholder="Can you please let us know why?. We are happy to speak to you"
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                        />
                    )}
                </div>

                <DialogFooter className="bg-white p-2 border-t">
                    <Button variant="outline" className="cursor-pointer font-goldman font-normal" onClick={handleNo}>
                        No
                    </Button>
                    <Button className="cursor-pointer bg-black text-white hover:bg-white hover:text-black hover:border font-goldman font-normal" onClick={handleYes}>Yes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
