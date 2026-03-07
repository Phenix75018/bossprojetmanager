import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "color-animation-enabled";

export function useColorAnimation() {
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("no-color-shift", !enabled);
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }, [enabled]);

  const toggle = useCallback(() => setEnabled((prev) => !prev), []);

  return { colorAnimationEnabled: enabled, toggleColorAnimation: toggle };
}
