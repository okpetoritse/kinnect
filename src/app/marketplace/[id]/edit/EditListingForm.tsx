
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteMarketplaceImage,
  updateListing,
} from "../../actions";
import { uploadMarketplaceImages } from "@/lib/marketplace/uploadImages";
import { MARKETPLACE_CATEGORIES } from "@/lib/marketplace/categories";
import styles from "../../new/page.module.css";
import pageStyles from "./page.module.css";

type Business = {
  id: string;
  name: string;
};

type EditableListing = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  category: string | null;
  location: string | null;
  business_id: string | null;
  image_urls: string[] | null;
};

const MAX_IMAGES = 5;

export default function EditListingForm({
  listing,
  businesses,
}: {
  listing: EditableListing;
  businesses: Business[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageUrls, setImageUrls] = useState<string[]>(
    listing.image_urls || []
  );
  const [newUploadedUrls, setNewUploadedUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [removingUrl, setRemovingUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [canceling, setCanceling] = useState(false);

  async function handleImageSelect(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) return;

    setUploading(true);
    setImageError("");

    try {
      const result = await uploadMarketplaceImages(
        files,
        imageUrls.length
      );

      if (result.urls.length) {
        setImageUrls((previous) => [...previous, ...result.urls]);
        setNewUploadedUrls((previous) => [
          ...previous,
          ...result.urls,
        ]);
      }

      if (result.error) setImageError(result.error);
    } catch (error) {
      console.error("Marketplace image upload failed:", error);
      setImageError("Could not upload the selected photos. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveImage(url: string) {
    setImageError("");

    // A newly uploaded image can be deleted immediately if it is
    // removed before the listing is saved.
    if (newUploadedUrls.includes(url)) {
      setRemovingUrl(url);

      const result = await deleteMarketplaceImage(url);

      if ("error" in result && result.error) {
        setImageError(result.error);
        setRemovingUrl("");
        return;
      }

      setNewUploadedUrls((previous) =>
        previous.filter((item) => item !== url)
      );
      setRemovingUrl("");
    }

    // Existing photos are removed from storage by the server action
    // only after the database update succeeds.
    setImageUrls((previous) => previous.filter((item) => item !== url));
  }

  async function handleCancel() {
    setCanceling(true);

    if (newUploadedUrls.length > 0) {
      await Promise.all(
        newUploadedUrls.map((url) => deleteMarketplaceImage(url))
      );
    }

    router.push(`/marketplace/${listing.id}`);
  }

  return (
    <form
      action={updateListing}
      className={pageStyles.form}
      onSubmit={(event) => {
        if (uploading || removingUrl || canceling) {
          event.preventDefault();
          setImageError("Please wait for the current operation to finish.");
        }
      }}
    >
      <input type="hidden" name="listingId" value={listing.id} />

      <input
        type="hidden"
        name="imageUrls"
        value={JSON.stringify(imageUrls)}
      />

      <div className={styles.imageUploadSection}>
        <h2 className={pageStyles.sectionHeading}>Listing photos</h2>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={handleImageSelect}
        />

        <button
          type="button"
          className={styles.imageBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || imageUrls.length >= MAX_IMAGES}
        >
          {uploading
            ? "Uploading photos..."
            : `Add photos (${imageUrls.length}/${MAX_IMAGES})`}
        </button>

        {imageUrls.length > 0 ? (
          <div className={styles.imagePreviewRow}>
            {imageUrls.map((url, index) => (
              <div className={styles.imagePreviewItem} key={url}>
                <img
                  src={url}
                  className={styles.imagePreview}
                  alt={`Listing photo ${index + 1}`}
                />

                <button
                  type="button"
                  className={styles.imageRemoveButton}
                  aria-label={`Remove photo ${index + 1}`}
                  disabled={removingUrl === url}
                  onClick={() => handleRemoveImage(url)}
                >
                  {removingUrl === url ? "…" : "×"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className={pageStyles.noImages}>No photos added.</p>
        )}

        {imageError && (
          <p className={styles.imageError} role="alert">
            {imageError}
          </p>
        )}

        <p className={styles.imageHelp}>
          JPEG, PNG or WebP. Maximum 5 MB per photo and 5 photos per listing.
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="title">
          Title
        </label>
        <input
          className={styles.input}
          id="title"
          name="title"
          defaultValue={listing.title}
          maxLength={120}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="price">
          Price (₦)
        </label>
        <input
          className={styles.input}
          id="price"
          name="price"
          type="number"
          min="0"
          step="0.01"
          defaultValue={listing.price ?? ""}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="category">
          Category
        </label>
        <select
          className={styles.select}
          id="category"
          name="category"
          defaultValue={listing.category || ""}
          required
        >
          <option value="" disabled>
            Choose a category
          </option>

          {MARKETPLACE_CATEGORIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.icon} {item.value}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="location">
          Location
        </label>
        <input
          className={styles.input}
          id="location"
          name="location"
          defaultValue={listing.location || ""}
          maxLength={120}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">
          Description
        </label>
        <textarea
          className={styles.textarea}
          id="description"
          name="description"
          defaultValue={listing.description || ""}
          maxLength={5000}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="businessId">
          Publish under
        </label>
        <select
          className={styles.select}
          id="businessId"
          name="businessId"
          defaultValue={listing.business_id || ""}
        >
          <option value="">Yourself (personal listing)</option>

          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
      </div>

      <div className={pageStyles.formActions}>
        <button
          className={styles.submit}
          type="submit"
          disabled={uploading || Boolean(removingUrl) || canceling}
        >
          {uploading ? "Uploading photos..." : "Save changes"}
        </button>

        <button
          className={pageStyles.cancelButton}
          type="button"
          onClick={handleCancel}
          disabled={uploading || Boolean(removingUrl) || canceling}
        >
          {canceling ? "Leaving..." : "Cancel"}
        </button>
      </div>
    </form>
  );
}
