
"use client";

import { createListing, deleteMarketplaceImage } from "../actions";
import { uploadMarketplaceImages } from "@/lib/marketplace/uploadImages";
import styles from "./page.module.css";
import { MARKETPLACE_CATEGORIES } from "@/lib/marketplace/categories";
import { useEffect, useRef, useState } from "react";

type Business = {
  id: string;
  name: string;
};

const MAX_IMAGES = 5;

export default function NewListingForm({
  businesses,
  initialBusinessId = "",
}: {
  businesses: Business[];
  initialBusinessId?: string;
}) {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [removingUrl, setRemovingUrl] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryError, setCategoryError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryPickerRef = useRef<HTMLDivElement>(null);

  const selectedCategoryItem = MARKETPLACE_CATEGORIES.find(
    (item) => item.value === selectedCategory
  );

  useEffect(() => {
    function handleOutsideClick(event: PointerEvent) {
      if (
        categoryPickerRef.current &&
        !categoryPickerRef.current.contains(event.target as Node)
      ) {
        setCategoryOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setCategoryOpen(false);
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

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
    setRemovingUrl(url);
    setImageError("");

    const result = await deleteMarketplaceImage(url);

    if ("error" in result && result.error) {
      setImageError(result.error);
    } else {
      setImageUrls((previous) => previous.filter((item) => item !== url));
    }

    setRemovingUrl("");
  }

  return (
    <form
      action={createListing}
      onSubmit={(event) => {
        if (uploading) {
          event.preventDefault();
          setImageError("Please wait for your photos to finish uploading.");
          return;
        }

        if (!selectedCategory) {
          event.preventDefault();
          setCategoryError(true);
          setCategoryOpen(true);
          return;
        }

        setCategoryError(false);
      }}
    >
      <input
        type="hidden"
        name="imageUrls"
        value={JSON.stringify(imageUrls)}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={handleImageSelect}
      />

      <div className={styles.imageUploadSection}>
        <button
          type="button"
          className={styles.imageBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || imageUrls.length >= MAX_IMAGES}
        >
          {uploading
            ? "Uploading photos..."
            : `📷 Add photos (${imageUrls.length}/${MAX_IMAGES})`}
        </button>

        {imageUrls.length > 0 && (
          <div className={styles.imagePreviewRow}>
            {imageUrls.map((url) => (
              <div className={styles.imagePreviewItem} key={url}>
                <img
                  src={url}
                  className={styles.imagePreview}
                  alt="Listing preview"
                />

                <button
                  type="button"
                  className={styles.imageRemoveButton}
                  aria-label="Remove photo"
                  disabled={removingUrl === url}
                  onClick={() => handleRemoveImage(url)}
                >
                  {removingUrl === url ? "…" : "×"}
                </button>
              </div>
            ))}
          </div>
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
          maxLength={120}
          required
        />
      </div>

      <div className={styles.row2}>
        <div className={styles.field} style={{ flex: 1 }}>
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
          />
        </div>

        <div
          className={styles.field}
          style={{ flex: 1 }}
          ref={categoryPickerRef}
        >
          <label className={styles.label} htmlFor="categoryPicker">
            Category
          </label>

          <input
            type="hidden"
            name="category"
            value={selectedCategory}
          />

          <button
            type="button"
            id="categoryPicker"
            className={`${styles.categoryTrigger} ${
              categoryError ? styles.categoryTriggerError : ""
            }`}
            aria-haspopup="listbox"
            aria-expanded={categoryOpen}
            aria-controls="marketplace-category-options"
            onClick={() => setCategoryOpen((previous) => !previous)}
          >
            <span className={styles.categoryTriggerValue}>
              {selectedCategoryItem ? (
                <>
                  <span>{selectedCategoryItem.icon}</span>
                  <span>{selectedCategoryItem.value}</span>
                </>
              ) : (
                <span className={styles.categoryPlaceholder}>
                  Choose a category
                </span>
              )}
            </span>

            <span className={styles.categoryChevron}>
              {categoryOpen ? "⌃" : "⌄"}
            </span>
          </button>

          {categoryOpen && (
            <div
              id="marketplace-category-options"
              className={styles.categoryMenu}
              role="listbox"
              aria-label="Marketplace categories"
            >
              {MARKETPLACE_CATEGORIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={selectedCategory === item.value}
                  className={`${styles.categoryOption} ${
                    selectedCategory === item.value
                      ? styles.categoryOptionActive
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedCategory(item.value);
                    setCategoryOpen(false);
                    setCategoryError(false);
                  }}
                >
                  <span className={styles.categoryOptionIcon}>
                    {item.icon}
                  </span>
                  <span>{item.value}</span>
                  {selectedCategory === item.value && (
                    <span className={styles.categoryCheck}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {categoryError && (
            <p className={styles.categoryError} role="alert">
              Please choose a category before posting.
            </p>
          )}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="location">
          Location
        </label>
        <input
          className={styles.input}
          id="location"
          name="location"
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
          maxLength={5000}
        />
      </div>

      {businesses.length > 0 && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="businessId">
            Post as
          </label>
          <select
            className={styles.select}
            id="businessId"
            name="businessId"
            defaultValue={initialBusinessId}
          >
            <option value="">Yourself (personal listing)</option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name} (business catalog)
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        className={styles.submit}
        type="submit"
        disabled={uploading || Boolean(removingUrl)}
      >
        {uploading ? "Uploading photos..." : "Post listing"}
      </button>
    </form>
  );
}
