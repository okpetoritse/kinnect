import { after } from "next/server";
import { sendPushToUser } from "./sendPush";

// Fire-and-forget that is actually safe on serverless: after() keeps the
// function alive until the pushes finish, without delaying the response.
export function queuePush(
  userIds: string | string[],
  title: string,
  body: string,
  url: string = "/"
) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  if (ids.length === 0) return;

  after(async () => {
    await Promise.allSettled(ids.map((id) => sendPushToUser(id, title, body, url)));
  });
}