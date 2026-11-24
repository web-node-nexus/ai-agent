import { ChatRoom } from "./chat-room";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return <ChatRoom conversationId={conversationId} />;
}
