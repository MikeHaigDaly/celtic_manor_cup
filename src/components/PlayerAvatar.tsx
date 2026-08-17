"use client";
import { useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Cropper, { type Area } from "react-easy-crop";
import { setPlayerPhoto } from "@/app/actions/playerPhoto";

const OUTPUT_SIZE = 512;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Renders the user's chosen crop area to a fixed-size square JPEG. */
async function cropToBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))), "image/jpeg", 0.92);
  });
}

/** Full-screen picker: drag to pan, pinch/scroll to zoom, round preview mask. */
function CropModal({
  imageSrc, onCancel, onConfirm, pending,
}: { imageSrc: string; onCancel: () => void; onConfirm: (area: Area) => void; pending: boolean }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-ink flex flex-col">
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={useCallback((_: Area, pixels: Area) => setArea(pixels), [])}
        />
      </div>
      <div className="flex items-center justify-between gap-3 p-4 bg-ink">
        <button type="button" onClick={onCancel} className="btn-outline flex-1 border-cream/30 text-cream">
          Cancel
        </button>
        <button
          type="button"
          disabled={!area || pending}
          onClick={() => area && onConfirm(area)}
          className="btn flex-1 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

/** Tap the avatar to open; tap the enlarged photo again to return. */
function ZoomModal({ photoUrl, name, onClose }: { photoUrl: string; name: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-ink/90 flex items-center justify-center p-8" onClick={onClose}>
      <div className="relative h-64 w-64 max-w-full max-h-full rounded-full overflow-hidden">
        <Image src={photoUrl} alt={name} fill sizes="256px" className="object-cover" />
      </div>
    </div>
  );
}

export function PlayerAvatar({
  playerId, name, photoUrl,
}: { playerId: string; name: string; photoUrl?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setPickedImage(URL.createObjectURL(file));
  }

  function closeCropModal() {
    if (pickedImage) URL.revokeObjectURL(pickedImage);
    setPickedImage(null);
  }

  function confirmCrop(area: Area) {
    if (!pickedImage) return;
    startTransition(async () => {
      try {
        const blob = await cropToBlob(pickedImage, area);
        const formData = new FormData();
        formData.set("photo", blob, "photo.jpg");
        await setPlayerPhoto(playerId, formData);
        closeCropModal();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        closeCropModal();
      }
    });
  }

  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("");

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => (photoUrl ? setZoomed(true) : inputRef.current?.click())}
        aria-label={photoUrl ? "View photo" : "Add photo"}
        className="h-16 w-16 rounded-full bg-ink/10 flex items-center justify-center display text-lg overflow-hidden relative active:opacity-80 transition"
      >
        {photoUrl ? (
          <Image src={photoUrl} alt={name} fill sizes="64px" className="object-cover" />
        ) : (
          initials
        )}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        aria-label="Change photo"
        className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-ink text-cream flex items-center justify-center text-[10px] border-2 border-cream"
      >
        ✎
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFilePicked} />
      {error && (
        <p className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[10px] text-usa whitespace-nowrap">
          {error}
        </p>
      )}
      {pickedImage && (
        <CropModal imageSrc={pickedImage} onCancel={closeCropModal} onConfirm={confirmCrop} pending={pending} />
      )}
      {zoomed && photoUrl && (
        <ZoomModal photoUrl={photoUrl} name={name} onClose={() => setZoomed(false)} />
      )}
    </div>
  );
}
