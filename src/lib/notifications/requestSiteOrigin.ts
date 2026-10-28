import "server-only";
import { headers } from "next/headers";

export async function getRequestSiteOrigin(): Promise<string | null> {
  const requestHeaders = await headers();
  const forwardedHost = (
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    ""
  ).split(",")[0].trim();
  const originHeader = requestHeaders.get("origin");

  let origin: URL;

  if (originHeader) {
    try {
      origin = new URL(originHeader);
    } catch {
      return null;
    }
  } else {
    if (!forwardedHost) return null;

    const forwardedProto = (requestHeaders.get("x-forwarded-proto") ?? "")
      .split(",")[0]
      .trim();
    const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(forwardedHost);
    const protocol = forwardedProto || (isLocalHost ? "http" : "https");

    try {
      origin = new URL(`${protocol}://${forwardedHost}`);
    } catch {
      return null;
    }
  }

  const localHttp = origin.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname.toLowerCase());

  if (origin.protocol !== "https:" && !localHttp) return null;
  if (forwardedHost && origin.host.toLowerCase() !== forwardedHost.toLowerCase()) {
    return null;
  }

  return origin.origin;
}
