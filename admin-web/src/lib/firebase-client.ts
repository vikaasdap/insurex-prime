import { signOut } from "firebase/auth";
import { getFirebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase";

export async function signOutFromGoogle() {
  if (typeof window === "undefined" || !isFirebaseClientConfigured) return;
  await signOut(getFirebaseAuth());
}
