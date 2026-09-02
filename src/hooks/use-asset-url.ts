"use client";

import { useEffect, useState } from "react";
import { getAssetBlobUrl } from "@/lib/data/local/asset-store";

/** Resolve an IndexedDB asset id to a displayable blob URL. */
export function useAssetUrl(assetId: string | undefined, fallbackUrl?: string): string | undefined {
  const [url, setUrl] = useState<string | undefined>(fallbackUrl);

  useEffect(() => {
    if (!assetId) {
      setUrl(fallbackUrl);
      return;
    }
    let cancelled = false;
    getAssetBlobUrl(assetId).then((blobUrl) => {
      if (!cancelled) setUrl(blobUrl ?? fallbackUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [assetId, fallbackUrl]);

  return url;
}
