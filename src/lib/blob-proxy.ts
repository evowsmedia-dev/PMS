export function toAppBlobUrl(blobUrl: string) {
  if (!blobUrl || blobUrl.startsWith("/api/blob")) return blobUrl;
  return `/api/blob?url=${encodeURIComponent(blobUrl)}`;
}
