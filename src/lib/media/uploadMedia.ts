import { createClient } from "@/lib/supabase/client";

const MAX_VIDEO_SIZE_MB = 50;
const MAX_IMAGE_SIZE_MB = 15;

export type MediaType = "image" | "video";

export function getMediaType(file: File): MediaType | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export async function uploadMedia(
  bucket: string,
  pathPrefix: string,
  file: File
): Promise<{ url?: string; type?: MediaType; error?: string }> {
  const type = getMediaType(file);
  if (!type) return { error: "Only images and videos are supported" };

  const maxMB = type === "video" ? MAX_VIDEO_SIZE_MB : MAX_IMAGE_SIZE_MB;
  if (file.size > maxMB * 1024 * 1024) {
    return { error: `${type === "video" ? "Videos" : "Images"} must be under ${maxMB}MB` };
  }

  const supabase = createClient();
  const filePath = `${pathPrefix}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file);

  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return { url: publicUrl, type };
}