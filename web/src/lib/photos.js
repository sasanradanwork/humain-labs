/**
 * Profile photos, fetched one face at a time.
 *
 * A photo is kept apart from the profile it belongs to, so the directory can list a
 * hundred researchers without carrying a hundred pictures. That leaves the pictures to be
 * asked for as they appear on screen, which is what this does: one request per researcher,
 * at most once, with the answer held for the rest of the session. A profile with no photo
 * is remembered as having none, so nothing asks a second time.
 */
import { useEffect, useState } from "react";

const cache = new Map(); // key -> dataUri | null (null means: asked, hasn't got one)
const inFlight = new Map(); // key -> promise, so ten cards sharing an author ask once

/** The key a photo is fetched by: public profiles by their public id, your own by id. */
export const photoKey = (r) => (r ? r.publicId || r.id : null);

export function photoOf(r) {
  const key = photoKey(r);
  return key && cache.has(key) ? cache.get(key) : null;
}

async function fetchPhoto(backend, key) {
  if (cache.has(key)) return cache.get(key);
  if (inFlight.has(key)) return inFlight.get(key);
  const p = backend
    .loadPhoto(key)
    .then((uri) => {
      cache.set(key, uri || null);
      return uri || null;
    })
    .catch(() => {
      // A 404 is an ordinary answer here — the profile simply has no picture.
      cache.set(key, null);
      return null;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

/**
 * The photo for one researcher, or null while it is on its way or if there isn't one.
 * Only profiles that say they have a photo are ever asked about.
 */
export function usePhoto(r, backend) {
  const key = photoKey(r);
  const has = !!(r && r.photo);
  const [uri, setUri] = useState(() => (has ? photoOf(r) : null));

  useEffect(() => {
    if (!has || !key || !backend?.loadPhoto) return;
    if (cache.has(key)) {
      setUri(cache.get(key));
      return;
    }
    let live = true;
    fetchPhoto(backend, key).then((got) => live && setUri(got));
    return () => {
      live = false;
    };
  }, [key, has, backend]);

  return has ? uri : null;
}

/** After saving or removing your own photo, so the next render shows what you just did. */
export function forgetPhoto(r) {
  const key = photoKey(r);
  if (key) cache.delete(key);
  // Your own profile is reachable under either id, and the editor saves under one of them.
  if (r && r.id) cache.delete(r.id);
  if (r && r.publicId) cache.delete(r.publicId);
}
