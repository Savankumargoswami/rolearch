import { notFound } from "next/navigation";
import { Suspense } from "react";
import { findRole } from "@/lib/seo-pages";
import { RolePage, roleMetadata } from "../role-page";

export async function generateMetadata({ params }: PageProps<"/roles/[role]">) {
  return roleMetadata((await params).role);
}

export default function Page({ params }: PageProps<"/roles/[role]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-5xl animate-pulse px-4 pt-10 sm:px-6" aria-hidden="true" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: PageProps<"/roles/[role]">["params"] }) {
  const { role } = await params;
  if (!findRole(role)) notFound();
  return <RolePage roleSlug={role} />;
}
