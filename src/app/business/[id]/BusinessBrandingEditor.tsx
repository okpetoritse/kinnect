
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveBusinessBrandAsset } from "../actions";
import styles from "./page.module.css";

type AssetType = "banner" | "logo";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function getExistingObjectPath(url: string | null) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const marker =
      "/storage/v1/object/public/business-assets/";

    const index = parsed.pathname.indexOf(marker);

    if (index === -1) return null;

    return decodeURIComponent(
      parsed.pathname.slice(index + marker.length)
    );
  } catch {
    return null;
  }
}

export default function BusinessBrandingEditor({
  businessId,
  bannerUrl,
  logoUrl,
}: {
  businessId: string;
  bannerUrl: string | null;
  logoUrl: string | null;
}) {
  const router = useRouter();

  const bannerInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<AssetType | null>(null);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  async function uploadAsset(
    type: AssetType,
    file: File | undefined
  ) {
    if (!file) return;

    const extension = ALLOWED_TYPES[file.type];

    if (!extension) {
      setHasError(true);
      setMessage("Choose a JPEG, PNG or WebP image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setHasError(true);
      setMessage("The image must not exceed 5 MB.");
      return;
    }

    setBusy(type);
    setMessage("");
    setHasError(false);

    const supabase = createClient();

    const objectPath =
      `${businessId}/${type}/${crypto.randomUUID()}.${extension}`;

    const previousUrl =
      type === "banner" ? bannerUrl : logoUrl;

    const previousPath = getExistingObjectPath(previousUrl);

    let uploaded = false;

    try {
      const { error: uploadError } = await supabase.storage
        .from("business-assets")
        .upload(objectPath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      uploaded = true;

      const result = await saveBusinessBrandAsset(
        businessId,
        type,
        objectPath
      );

      if (!result.success || result.error) {
        throw new Error(
          result.error || "Could not save the business image."
        );
      }

      // Only remove the previous image after the new one is saved.
      if (previousPath && previousPath !== objectPath) {
        const { error: cleanupError } = await supabase.storage
          .from("business-assets")
          .remove([previousPath]);

        if (cleanupError) {
          console.warn(
            "Previous business image cleanup failed:",
            cleanupError.message
          );
        }
      }

      setMessage(
        type === "banner"
          ? "Business banner updated successfully."
          : "Business logo updated successfully."
      );

      router.refresh();
    } catch (error) {
      if (uploaded) {
        const { error: cleanupError } = await supabase.storage
          .from("business-assets")
          .remove([objectPath]);

        if (cleanupError) {
          console.warn(
            "Could not clean up failed upload:",
            cleanupError.message
          );
        }
      }

      setHasError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "Image upload failed. Please try again."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={styles.brandingEditor}>
      <div className={styles.brandingEditorHeader}>
        <h3 className={styles.brandingEditorTitle}>
          Storefront appearance
        </h3>

        <p className={styles.brandingEditorSubtitle}>
          Give customers a recognisable business identity.
        </p>
      </div>

      <div className={styles.brandingEditorActions}>
        <button
          type="button"
          className={styles.brandingUploadButton}
          disabled={busy !== null}
          onClick={() => bannerInput.current?.click()}
        >
          {busy === "banner" ? "Uploading..." : "Change banner"}
        </button>

        <input
          ref={bannerInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => {
            void uploadAsset("banner", event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <button
          type="button"
          className={styles.brandingUploadButton}
          disabled={busy !== null}
          onClick={() => logoInput.current?.click()}
        >
          {busy === "logo" ? "Uploading..." : "Change logo"}
        </button>

        <input
          ref={logoInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => {
            void uploadAsset("logo", event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      {message && (
        <p
          className={
            hasError
              ? styles.brandingError
              : styles.brandingSuccess
          }
          role="status"
        >
          {message}
        </p>
      )}

      <p className={styles.brandingHint}>
        JPEG, PNG or WebP · Maximum 5 MB per image.
      </p>
    </section>
  );
}
