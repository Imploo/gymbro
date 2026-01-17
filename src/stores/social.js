import { defineStore } from "pinia";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuthStore } from "./auth";
import {
  isE2E,
  getFriendshipDocId,
  getProfileSummary,
} from "../utils/storeHelpers";

export const useSocialStore = defineStore("social", {
  state: () => ({
    friends: [],
    friendRequests: [],
    userSearchResults: [],
  }),
  actions: {
    async searchUsers(term) {
      const auth = useAuthStore();
      if (!auth.user || isE2E) {
        this.userSearchResults = [];
        return [];
      }
      const trimmed = term.trim();
      if (!trimmed) {
        this.userSearchResults = [];
        return [];
      }

      const usersRef = collection(db, "users");
      const displayQuery = query(
        usersRef,
        orderBy("profile.displayName"),
        where("profile.displayName", ">=", trimmed),
        where("profile.displayName", "<=", `${trimmed}\uf8ff`)
      );
      const emailQuery = query(
        usersRef,
        orderBy("profile.email"),
        where("profile.email", ">=", trimmed),
        where("profile.email", "<=", `${trimmed}\uf8ff`)
      );

      try {
        const [displaySnap, emailSnap] = await Promise.all([
          getDocs(displayQuery),
          getDocs(emailQuery),
        ]);
        const usersMap = new Map();
        displaySnap.docs.forEach((docSnap) => {
          if (docSnap.id === auth.user.uid) return;
          usersMap.set(docSnap.id, getProfileSummary({ id: docSnap.id, ...docSnap.data() }));
        });
        emailSnap.docs.forEach((docSnap) => {
          if (docSnap.id === auth.user.uid) return;
          usersMap.set(docSnap.id, getProfileSummary({ id: docSnap.id, ...docSnap.data() }));
        });

        const results = Array.from(usersMap.values());
        this.userSearchResults = results;
        return results;
      } catch (error) {
        this.userSearchResults = [];
        return [];
      }
    },
    async loadFriendships() {
      const auth = useAuthStore();
      if (!auth.user || isE2E) {
        this.friends = [];
        this.friendRequests = [];
        return;
      }

      const q = query(
        collection(db, "friendships"),
        where("userIds", "array-contains", auth.user.uid)
      );
      const snap = await getDocs(q);
      const all = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      await Promise.all(
        all.map(async (friendship) => {
          const [uid1, uid2] = friendship.userIds || [];
          if (!uid1 || !uid2) return;
          const desiredId = getFriendshipDocId(uid1, uid2);
          if (desiredId === friendship.id) return;
          const desiredRef = doc(db, "friendships", desiredId);
          const desiredSnap = await getDoc(desiredRef);
          if (!desiredSnap.exists()) {
            await setDoc(desiredRef, {
              userIds: [uid1, uid2],
              requestedBy: friendship.requestedBy ?? uid1,
              status: friendship.status ?? "pending",
              createdAt: friendship.createdAt ?? Date.now(),
              acceptedAt: friendship.acceptedAt ?? null,
            });
          }
          await deleteDoc(doc(db, "friendships", friendship.id));
        })
      );
      const accepted = all.filter((item) => item.status === "accepted");
      const pending = all.filter(
        (item) => item.status === "pending" && item.requestedBy !== auth.user.uid
      );

      const friendProfiles = await Promise.all(
        accepted.map(async (friendship) => {
          const otherId = friendship.userIds.find((id) => id !== auth.user.uid);
          if (!otherId) return null;
          const otherSnap = await getDoc(doc(db, "users", otherId));
          if (!otherSnap.exists()) return null;
          return {
            friendshipId: friendship.id,
            ...getProfileSummary({ id: otherSnap.id, ...otherSnap.data() }),
          };
        })
      );

      const requestProfiles = await Promise.all(
        pending.map(async (request) => {
          const requesterId = request.requestedBy;
          if (!requesterId) return null;
          const requesterSnap = await getDoc(doc(db, "users", requesterId));
          if (!requesterSnap.exists()) return null;
          return {
            id: request.id,
            requester: getProfileSummary({
              id: requesterSnap.id,
              ...requesterSnap.data(),
            }),
          };
        })
      );

      this.friends = friendProfiles.filter(Boolean);
      this.friendRequests = requestProfiles.filter(Boolean);
    },
    async sendFriendRequest(partner) {
      const auth = useAuthStore();
      if (!auth.user || isE2E) return;
      const partnerId = partner?.uid;
      if (!partnerId || partnerId === auth.user.uid) return;

      await this.loadFriendships();
      const alreadyFriend = this.friends.some((item) => item.uid === partnerId);
      if (alreadyFriend) return;

      const pendingQuery = query(
        collection(db, "friendships"),
        where("userIds", "array-contains", auth.user.uid)
      );
      const pendingSnap = await getDocs(pendingQuery);
      const hasPending = pendingSnap.docs.some((docSnap) => {
        const data = docSnap.data();
        return data.status === "pending" && (data.userIds || []).includes(partnerId);
      });
      if (hasPending) return;

      const friendshipId = getFriendshipDocId(auth.user.uid, partnerId);
      const ref = doc(db, "friendships", friendshipId);
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === "accepted") return;
          if (data.status === "pending") return;
        }
        transaction.set(ref, {
          userIds: [auth.user.uid, partnerId],
          requestedBy: auth.user.uid,
          status: "pending",
          createdAt: Date.now(),
        });
      });
      await this.loadFriendships();
    },
    async acceptFriendRequest(friendshipId) {
      const auth = useAuthStore();
      if (!auth.user || isE2E) return;
      const ref = doc(db, "friendships", friendshipId);
      await updateDoc(ref, { status: "accepted", acceptedAt: Date.now() });
      await this.loadFriendships();
    },
    async declineFriendRequest(friendshipId) {
      const auth = useAuthStore();
      if (!auth.user || isE2E) return;
      const ref = doc(db, "friendships", friendshipId);
      await deleteDoc(ref);
      await this.loadFriendships();
    },
    async unlinkFriend(friendshipId) {
      return this.declineFriendRequest(friendshipId);
    },
  },
});
