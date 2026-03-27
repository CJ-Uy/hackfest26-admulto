import { redirect } from "next/navigation";

export default async function ScrollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/schroll/${id}`);
}
