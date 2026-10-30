function normalizeInternalPath(value) {
  try {
    const candidate = typeof value === "string" ? value : "/";
    const url = new URL(candidate, self.location.origin);

    if (url.origin !== self.location.origin) return "/";

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function brandedTitle(value) {
  const title = typeof value === "string" ? value.trim() : "";

  if (!title) return "Kinnect";
  if (/^kinnect\b/i.test(title)) return title;

  return `Kinnect · ${title}`;
}

self.addEventListener("push", (event) => {
  let data = {};

  try {
    const parsed = event.data ? event.data.json() : {};
    if (parsed && typeof parsed === "object") data = parsed;
  } catch {
    data = {
      body: event.data ? event.data.text() : "",
    };
  }

  const title = brandedTitle(data.title);
  const targetPath = normalizeInternalPath(data.url);
  const tag = typeof data.tag === "string" && data.tag ? data.tag : "";

  event.waitUntil(
    (async () => {
      if (data.type === "call-ended") {
        if (tag) {
          const existing = await self.registration.getNotifications({ tag });
          existing.forEach((notification) => notification.close());
        }
        return;
      }

      if (data.type === "incoming-call") {
        const invitationId = data.callInvitationId;
        const expiry = Date.parse(data.expiresAt);

        if (
          typeof invitationId !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(invitationId) ||
          !Number.isFinite(expiry) ||
          expiry <= Date.now()
        ) {
          return;
        }

        let verification = null;

        try {
          const statusUrl = new URL(
            "/api/call-invitations/" +
              encodeURIComponent(invitationId) +
              "/status",
            self.location.origin
          );

          const response = await fetch(statusUrl, {
            method: "GET",
            cache: "no-store",
            credentials: "omit",
            headers: { Accept: "application/json" },
          });

          if (response.ok) verification = await response.json();
        } catch (error) {
          console.warn("[Push] Incoming call verification failed:", error);
        }

        if (verification?.active !== true) return;
      }

      let body = typeof data.body === "string" ? data.body : "";
      let messageCount = 1;
      const isDirectMessage = tag.startsWith("kinnect:dm:");

      if (isDirectMessage) {
        const previous = await self.registration.getNotifications({ tag });

        if (previous.length > 0) {
          const previousCount = previous.reduce((max, notification) => {
            const storedCount = Number(notification.data?.messageCount);
            return Math.max(
              max,
              Number.isSafeInteger(storedCount) && storedCount > 0 ? storedCount : 1
            );
          }, 1);

          messageCount = previousCount + 1;
          body = String(messageCount) + " new messages: " + body;
        }
      }

      const options = {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/notification-badge.svg",
        ...(tag ? { tag } : {}),
        renotify: false,
        data: {
          url: targetPath,
          ...(isDirectMessage ? { messageCount } : {}),
          ...(data.type === "incoming-call"
            ? {
                type: "incoming-call",
                callInvitationId: data.callInvitationId,
                expiresAt: data.expiresAt,
              }
            : {}),
        },
      };

      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetPath = normalizeInternalPath(event.notification.data?.url);
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clients) {
        let clientOrigin;

        try {
          clientOrigin = new URL(client.url).origin;
        } catch {
          continue;
        }

        if (clientOrigin !== self.location.origin) continue;

        try {
          if (client.url !== targetUrl) {
            const navigatedClient = await client.navigate(targetUrl);
            if (navigatedClient) return navigatedClient.focus();
          }

          return client.focus();
        } catch (error) {
          console.warn("[PUSH] Could not focus an existing app window:", error);
        }
      }

      return self.clients.openWindow(targetUrl);
    })()
  );
});