import { useEffect } from "react";

const blockers = new Set();
export function updateBlocked() { return blockers.size > 0; }

// Keep map-only edits and in-flight saves protected even when the editor is collapsed.
export default function useUpdateBlocker(blocked) {
  useEffect(() => {
    if (!blocked) return;
    const token = {};
    blockers.add(token);
    return () => { blockers.delete(token); };
  }, [blocked]);
}
