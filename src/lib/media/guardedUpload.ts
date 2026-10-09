export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 180000;

export function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Rejects if the upload hangs too long or the device goes offline mid-upload,
// so the UI can show a real error instead of waiting forever.
export function guardedUpload<T>(task: PromiseLike<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("offline", onOffline);
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };
    const onOffline = () => fail("offline");
    const timer = setTimeout(() => fail("timeout"), UPLOAD_TIMEOUT_MS);

    window.addEventListener("offline", onOffline);

    Promise.resolve(task).then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      () => fail("network")
    );
  });
}