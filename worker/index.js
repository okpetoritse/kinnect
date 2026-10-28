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

  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/icons/icon-192.png",
    badge: "/icons/notification-badge.svg",
    ...(typeof data.tag === "string" && data.tag ? { tag: data.tag } : {}),
    renotify: false,
    data: { url: targetPath },
  };

  event.waitUntil(self.registration.showNotification(title, options));
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