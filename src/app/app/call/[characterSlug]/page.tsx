import { CallRoom } from "./call-room";

export default async function CallPage({
  params,
}: {
  params: Promise<{ characterSlug: string }>;
}) {
  const { characterSlug } = await params;
  return <CallRoom characterSlug={characterSlug} />;
}
