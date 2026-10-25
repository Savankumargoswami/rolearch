import { notFound } from "next/navigation";
import { Suspense } from "react";
import { findPlace, findRole, ROLES } from "@/lib/seo-pages";
import { RolePage, roleMetadata } from "../../role-page";

export function generateStaticParams() {
  return ROLES.slice(0, 1).map((r) => ({ role: r.slug, place: "remote" }));
}

export async function generateMetadata({ params }: PageProps<"/roles/[role]/[place]">) {
  const { role, place } = await params;
  return roleMetadata(role, place);
}

export default function Page({ params }: PageProps<"/roles/[role]/[place]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-5xl animate-pulse px-4 pt-10 sm:px-6" aria-hidden="true" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: PageProps<"/roles/[role]/[place]">["params"] }) {
  const { role, place } = await params;
  if (!findRole(role) || !findPlace(place)) notFound();
  return <RolePage roleSlug={role} placeSlug={place} />;
}
