/**
 * Browser capability detection for local folder sync.
 */
export function supportsFileSystemAccess(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export function supportsIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}
