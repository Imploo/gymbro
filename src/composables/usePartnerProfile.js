import { computed, unref } from "vue";

export const usePartnerProfile = (sharedSessionRef, currentUidRef) =>
  computed(() => {
    const sharedSession = unref(sharedSessionRef);
    const currentUid = unref(currentUidRef);
    if (!sharedSession?.participants) return null;
    const entries = Object.entries(sharedSession.participants);
    const other = entries.find(([uid]) => uid !== currentUid);
    if (!other) return null;
    const [uid, data] = other;
    return { uid, ...data };
  });
