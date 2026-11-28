/**
 * Choosing a profile photo.
 *
 * The picture is squared off and shrunk here, in the browser, before it goes anywhere:
 * a phone camera file is several megabytes and none of that detail survives being shown
 * at 96 pixels. What gets sent is a 256px square, WebP where the browser can write it,
 * which lands around 15KB.
 */
import { useRef, useState } from "react";
import { Avatar, Icon } from "./ui.jsx";
import { useUI } from "../lib/ui.jsx";
import { forgetPhoto, usePhoto } from "../lib/photos.js";

const SIDE = 256; // stored size; shown at 96 at most, with room for sharp screens
const BUDGET = 180 * 1024; // what the server will take, with headroom under its own cap
const TYPES = ["image/webp", "image/jpeg", "image/png"];

/** Centre-crop to a square and re-encode, dropping quality until it fits the budget. */
async function squared(file) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That file could not be read as an image.");
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIDE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIDE, SIDE);
  bitmap.close?.();

  // WebP where it exists, JPEG otherwise; both are a tenth of the PNG at this size.
  const type = canvas.toDataURL("image/webp").startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
  for (const q of [0.85, 0.75, 0.6, 0.45]) {
    const uri = canvas.toDataURL(type, q);
    if (Math.ceil((uri.length - uri.indexOf(",") - 1) * 0.75) <= BUDGET) return uri;
  }
  throw new Error("That image is too detailed to shrink. Try a different one.");
}

export function PhotoField({ researcher }) {
  const { backend, toast } = useUI();
  const stored = usePhoto(researcher, backend);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const shown = preview || stored;
  const name = researcher?.name || "you";

  const choose = async (file) => {
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      toast("Choose a PNG, JPEG or WebP image.");
      return;
    }
    setBusy(true);
    try {
      const uri = await squared(file);
      await backend.savePhoto(uri);
      forgetPhoto(researcher);
      setPreview(uri);
      toast("Photo saved.");
    } catch (e) {
      toast(e.message || "That photo could not be saved.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await backend.deletePhoto();
      forgetPhoto(researcher);
      setPreview(null);
      toast("Photo removed.");
    } catch (e) {
      toast(e.message || "That photo could not be removed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="photo-field">
      <Avatar name={name} size={76} src={shown} />
      <div className="photo-do">
        <div className="photo-btns">
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => input.current?.click()}>
            {shown ? "Change photo" : "Add a photo"}
          </button>
          {shown && (
            <button type="button" className="btn btn-sm" disabled={busy} onClick={remove}>
              Remove
            </button>
          )}
        </div>
        <p className="hint">
          {busy ? "Working…" : "A square crop of the middle, shrunk to 256px. PNG, JPEG or WebP."}
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => choose(e.target.files?.[0])}
      />
    </div>
  );
}
