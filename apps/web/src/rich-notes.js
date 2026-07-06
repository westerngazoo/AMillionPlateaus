export const MEDIA_BYTE_CAP = 256 * 1024; // 256 KB

export function boundImage(w, h, maxEdge = 1400) {
  const s = Math.min(1, maxEdge / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

export function safeImageSrc(uri) {
  return /^resource:\/\/local\/[\w-]+$/.test(uri) ||
    /^data:image\/(png|jpeg|webp);base64,/.test(uri)
    ? uri : null;
}
