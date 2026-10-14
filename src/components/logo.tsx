// Brand logo from the Rolearch logo kit (public/brand/), cropped to its artwork.
// Artwork ratio is 833:149; height drives the size.
const RATIO = 833 / 149;

export function Logo({ height = 28, reversed = false, className = "" }: { height?: number; reversed?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG; next/image adds nothing for vector art
    <img
      src={reversed ? "/brand/logo-reversed.svg" : "/brand/logo.svg"}
      alt="Rolearch"
      width={Math.round(height * RATIO)}
      height={height}
      className={`block ${className}`}
      fetchPriority="high"
    />
  );
}
