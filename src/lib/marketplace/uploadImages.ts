import { createClient } from "@/lib/supabase/client";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_LISTING_IMAGES = 5;

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type UploadResult = {
  urls: string[];
  error: string | null;
};

export async function uploadMarketplaceImages(
  files: File[],
  currentCount: number
): Promise<UploadResult> {
  const remaining = Math.max(0, MAX_LISTING_IMAGES - currentCount);

  if (remaining === 0) {
    return {
      urls: [],
      error: "A listing can have a maximum of five photos.",
    };
  }

  const selectedFiles = files.slice(0, remaining);
  const errors: string[] = [];

  if (files.length > remaining) {
    errors.push("Only enough photos to reach the five-photo limit were selected.");
  }

  const validFiles = selectedFiles.filter((file) => {
    if (!ALLOWED_IMAGE_TYPES[file.type]) {
      errors.push(`${file.name}: use JPEG, PNG or WebP.`);
      return false;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      errors.push(`${file.name}: the maximum file size is 5 MB.`);
      return false;
    }

    if (file.size === 0) {
      errors.push(`${file.name}: the file is empty.`);
      return false;
    }

    return true;
  });

  if (validFiles.length === 0) {
    return {
      urls: [],
      error: errors.join(" ") || "Choose a valid image.",
    };
  }

  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      urls: [],
      error: "Your session could not be verified. Please sign in again.",
    };
  }

  const results = await Promise.all(
    validFiles.map(async (file) => {
      const extension = ALLOWED_IMAGE_TYPES[file.type];
      const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error } = await supabase.storage
        .from("marketplace")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (error) {
        return {
          url: null,
          error: `${file.name}: ${error.message}`,
        };
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("marketplace").getPublicUrl(filePath);

      return { url: publicUrl, error: null };
    })
  );

  const urls = results
    .map((result) => result.url)
    .filter((url): url is string => Boolean(url));

  results.forEach((result) => {
    if (result.error) errors.push(result.error);
  });

  return {
    urls,
    error: errors.length ? errors.join(" ") : null,
  };
}