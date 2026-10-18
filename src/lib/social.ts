// Follows and posts, read with the signed-in member's own Supabase session (row-level security applies).
import "server-only";
import type { PostKind } from "./post-review";
import { createClient, supabaseUrl } from "./supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Social = { followers: number; following: number; posts: number; isFollowing: boolean };

export type Post = {
  id: string;
  kind: PostKind;
  body: string;
  link: string;
  images: string[];
  createdAt: string;
  /** "3 hr. ago", computed when the posts are loaded. */
  ago: string;
  author: { id: string; name: string; headline: string; avatarUrl: string };
};

export const postImageUrl = (path: string) => `${supabaseUrl}/storage/v1/object/public/post-images/${path}`;

export async function loadSocial(supabase: Supabase, profileId: string, viewerId: string): Promise<Social> {
  const [followers, following, posts, mine] = await Promise.all([
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", profileId),
    supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", profileId),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", profileId),
    profileId === viewerId
      ? Promise.resolve({ data: null })
      : supabase.from("follows").select("following_id").eq("follower_id", viewerId).eq("following_id", profileId).maybeSingle(),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0, posts: posts.count ?? 0, isFollowing: Boolean(mine.data) };
}

const POST_COLUMNS = "id, kind, body, link, images, created_at, author:profiles!posts_author_id_fkey(id, full_name, headline, avatar_url)";

type PostRow = {
  id: string;
  kind: PostKind;
  body: string;
  link: string;
  images: string[] | null;
  created_at: string;
  author: { id: string; full_name: string; headline: string; avatar_url: string } | null;
};

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });
export function ago(iso: string, now: number) {
  const s = Math.round((Date.parse(iso) - now) / 1000);
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
  ];
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(0, "second");
  for (let i = 1; i < steps.length; i++) if (abs < steps[i][0]) return rtf.format(Math.round(s / steps[i - 1][0]), steps[i][1]);
  return rtf.format(Math.round(s / 31557600), "year");
}

function toPost(r: PostRow, now: number): Post {
  return {
    id: r.id,
    kind: r.kind,
    body: r.body,
    link: r.link,
    images: (r.images ?? []).map(postImageUrl),
    createdAt: r.created_at,
    ago: ago(r.created_at, now),
    author: { id: r.author?.id ?? "", name: r.author?.full_name || "Rolearch member", headline: r.author?.headline ?? "", avatarUrl: r.author?.avatar_url ?? "" },
  };
}

/** Newest posts: by one author, by the people someone follows (plus their own), or by everyone. */
export async function listPosts(supabase: Supabase, filter: { authorId?: string; followedBy?: string }, limit = 30): Promise<Post[]> {
  let query = supabase.from("posts").select(POST_COLUMNS).order("created_at", { ascending: false }).limit(limit);
  if (filter.authorId) query = query.eq("author_id", filter.authorId);
  if (filter.followedBy) {
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", filter.followedBy).limit(1000);
    query = query.in("author_id", [filter.followedBy, ...(data ?? []).map((f) => f.following_id as string)]);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[posts] list failed:", error.message);
    return [];
  }
  const now = Date.now();
  return (data as unknown as PostRow[]).map((r) => toPost(r, now));
}

/** The signed-in member's id, or null. */
export async function viewerId(supabase: Supabase): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export type Person = { id: string; name: string; headline: string; location: string; avatarUrl: string; isCompany: boolean; skills: string[] };

/** Members matching every word of the query, best matches first (name, then headline, then skills). */
export async function searchPeople(supabase: Supabase, q: string, limit = 20): Promise<Person[]> {
  if (!q.trim()) return [];
  const { data, error } = await supabase.rpc("search_profiles", { q: q.slice(0, 100), lim: limit });
  if (error) {
    console.error("[search] people failed:", error.message);
    return [];
  }
  return (data as { id: string; full_name: string; company_name: string; headline: string; location: string; avatar_url: string; account_type: string; skills: string[] | null }[]).map((r) => ({
    id: r.id,
    name: r.account_type === "company" ? r.company_name || r.full_name : r.full_name || r.company_name,
    headline: r.headline,
    location: r.location,
    avatarUrl: r.avatar_url,
    isCompany: r.account_type === "company",
    skills: r.skills ?? [],
  }));
}
