import "server-only";
import { redirect } from "next/navigation";
import { loadViewer } from "./profile";

/** The signed-in member, or a redirect to sign-up that brings them back to `next` afterwards. */
export async function requireMember(next: string) {
  const viewer = await loadViewer();
  if (!viewer) redirect(`/signup?next=${encodeURIComponent(next)}`);
  return viewer;
}
