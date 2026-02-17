import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageLightboxProps {
  src: string | null;
  open: boolean;
  onClose: () => void;
}

export default function ImageLightbox({ src, open, onClose }: ImageLightboxProps) {
  if (!src) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-transparent shadow-none [&>button]:hidden">
        <div className="relative flex items-center justify-center">
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 z-10 rounded-full bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
          <img
            src={src}
            alt="Preview"
            className="max-h-[85vh] max-w-[88vw] rounded-lg object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
