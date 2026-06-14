"use client";

import { use } from "react";
import { RoomPage } from "@/components/room/RoomPage";

interface Props {
  params: Promise<{ roomId: string }>;
}

export default function Page({ params }: Props) {
  const { roomId } = use(params);
  return <RoomPage roomId={roomId} />;
}
