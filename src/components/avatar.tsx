import Image from "next/image";

const PHOTO_PREFIX = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "")}/storage/v1/object/public/avatars/`;

/** Only photos from our own avatars bucket are shown; anything else falls back to initials. */
export const isOwnPhoto = (url: string) => PHOTO_PREFIX.length > 40 && url.startsWith(PHOTO_PREFIX);

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** A round profile photo, or the person's initials on ink when there's no photo. */
export function Avatar({
  url,
  name,
  size,
  className = "",
  fallbackClass = "bg-ink text-paper",
  priority,
}: {
  url: string;
  name: string;
  size: number;
  className?: string;
  fallbackClass?: string;
  priority?: boolean;
}) {
  const box = `relative shrink-0 overflow-hidden rounded-full ${className}`;
  if (url && isOwnPhoto(url)) {
    return (
      <span className={`${box} block`} style={{ width: size, height: size }}>
        <Image src={url} alt={name} fill sizes={`${size}px`} priority={priority} className="object-cover" />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={`${box} grid place-items-center font-display font-semibold ${fallbackClass}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}
