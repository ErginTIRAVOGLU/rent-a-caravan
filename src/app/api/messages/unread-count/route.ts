import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GET /api/messages/unread-count
 * Returns the count of unread messages for the current user.
 * Currently returns 0 as a placeholder until messaging is implemented.
 */
export async function GET() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || user.isBanned) {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }

  // TODO: Implement actual unread message count query when messaging feature is added
  // For now, return 0 as placeholder
  const unreadCount = 0;

  return NextResponse.json({ count: unreadCount });
}