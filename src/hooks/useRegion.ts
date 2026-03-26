import { useState, useCallback, useEffect } from "react";
import { getRegion, setRegion as persistRegion, type Region } from "@/lib/regionConfig";

/**
 * Hook to access and change the user's region (br/eu).
 * Syncs with language changes automatically.
 */
export function useRegion() {
  const [region, setRegionState] = useState<Region>(getRegion);

  // Listen for language changes that might imply region change
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'garageflow_region') {
        setRegionState(getRegion());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setRegion = useCallback((r: Region) => {
    persistRegion(r);
    setRegionState(r);
  }, []);

  return { region, setRegion, isBrazil: region === 'br' };
}
