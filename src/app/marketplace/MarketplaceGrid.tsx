
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getListings } from "./actions";
import SponsoredBadge from "@/components/SponsoredBadge";
import { MARKETPLACE_CATEGORIES } from "@/lib/marketplace/categories";
import styles from "./page.module.css";

type SellerInfo = {
  id: string;
  full_name: string | null;
};

type BusinessInfo = {
  id: string;
  name: string;
  verified: boolean | null;
};

export type Listing = {
  id: string;
  title: string;
  is_sponsored?: boolean;
  price: number | null;
  currency: string | null;
  category: string | null;
  location: string | null;
  image_urls: string[] | null;
  is_promoted?: boolean;
  promoted_until?: string | null;
  seller_country?: string | null;
  seller?: SellerInfo | SellerInfo[] | null;
  business?: BusinessInfo | BusinessInfo[] | null;
};

type SortOption = "newest" | "price-low" | "price-high";

export default function MarketplaceGrid({
  initial,
  initialCursor,
  myCountry,
}: {
  initial: Listing[];
  initialCursor: string | null;
  myCountry: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [allRegions, setAllRegions] = useState(false);
  const [sort, setSort] = useState<SortOption>("newest");

  const [listings, setListings] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);

  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const requestVersion = useRef(0);

  useEffect(() => {
    const version = ++requestVersion.current;
    let cancelled = false;


    const timeout = window.setTimeout(async () => {
      setSearching(true);

      try {
        const result = await getListings({
          query,
          category: category || undefined,
          country: myCountry,
          allRegions,
          sort,
        });

        if (!cancelled && version === requestVersion.current) {
          setListings(result.listings as Listing[]);
          setCursor(result.nextCursor);
        }
      } catch (error) {
        console.error("Marketplace search failed:", error);
      } finally {
        if (!cancelled && version === requestVersion.current) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [query, category, allRegions, myCountry, sort]);

  async function handleLoadMore() {
    if (!cursor || loadingMore || searching) return;

    const version = requestVersion.current;
    setLoadingMore(true);

    try {
      const result = await getListings({
        query,
        category: category || undefined,
        cursor,
        country: myCountry,
        allRegions,
        sort,
      });

      if (version === requestVersion.current) {
        setListings((previous) => {
          const existingIds = new Set(
            previous.map((listing) => listing.id)
          );

          const newListings = (result.listings as Listing[]).filter(
            (listing) => !existingIds.has(listing.id)
          );

          return [...previous, ...newListings];
        });

        setCursor(result.nextCursor);
      }
    } catch (error) {
      console.error("Could not load more listings:", error);
    } finally {
      setLoadingMore(false);
    }
  }

  function clearFilters() {
    setQuery("");
    setCategory("");
    setSort("newest");
    setAllRegions(false);
  }

  return (
    <div className={styles.discovery}>
      <div className={styles.searchArea}>
        <input
          className={styles.searchInput}
          placeholder="What are you looking for?"
          aria-label="Search products and services"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <p className={styles.discoveryHint}>
          Discover products, services and people worth knowing.
        </p>
      </div>

      <section className={styles.categorySection}>
        <div className={styles.categoryHeading}>
          Explore categories
        </div>

        <div className={styles.categoryScroller}>
          <button
            type="button"
            className={`${styles.categoryChip} ${
              category === "" ? styles.categoryChipActive : ""
            }`}
            onClick={() => setCategory("")}
            aria-pressed={category === ""}
          >
            <span>✨</span>
            <span>All</span>
          </button>

          {MARKETPLACE_CATEGORIES.map((item) => (
            <button
              type="button"
              key={item.value}
              className={`${styles.categoryChip} ${
                category === item.value
                  ? styles.categoryChipActive
                  : ""
              }`}
              onClick={() => setCategory(item.value)}
              aria-pressed={category === item.value}
            >
              <span>{item.icon}</span>
              <span>{item.value}</span>
            </button>
          ))}
        </div>
      </section>

      <div className={styles.discoveryControls}>
        <div className={styles.regionRow}>
          <span>
            {allRegions
              ? "Showing all regions"
              : myCountry
              ? `In ${myCountry}`
              : "Showing listings from all regions"}
          </span>

          {myCountry && (
            <button
              type="button"
              className={styles.regionToggle}
              onClick={() => setAllRegions((previous) => !previous)}
            >
              {allRegions ? "My region" : "All regions"}
            </button>
          )}
        </div>

        <label className={styles.sortControl}>
          <span>Sort:</span>

          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as SortOption)
            }
            aria-label="Sort listings"
          >
            <option value="newest">Newest first</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </label>
      </div>

      <div className={styles.resultsHeading}>
        <h2>
          {category || (query.trim() ? "Search results" : "Discover")}
        </h2>

        {searching && (
          <span className={styles.loadingLabel}>Updating…</span>
        )}
      </div>

      {listings.length > 0 ? (
        <div className={styles.grid}>
          {listings.map((listing) => {
            const seller = Array.isArray(listing.seller)
              ? listing.seller[0]
              : listing.seller;

            const business = Array.isArray(listing.business)
              ? listing.business[0]
              : listing.business;

            const isSponsored = listing.is_sponsored === true;

            return (
              <Link
                key={listing.id}
                href={`/marketplace/${listing.id}`}
                className={styles.card}
              >
                {listing.image_urls?.[0] ? (
                  <img
                    src={listing.image_urls[0]}
                    className={styles.cardImage}
                    alt={listing.title}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.cardImagePlaceholder}>
                    <span>
                      {MARKETPLACE_CATEGORIES.find(
                        (item) => item.value === listing.category
                      )?.icon || "🛍️"}
                    </span>
                  </div>
                )}

                <div className={styles.cardBody}>
                  {isSponsored && <SponsoredBadge />}

                  <div className={styles.cardTitle}>
                    {listing.title}
                  </div>

                  {listing.price != null ? (
                    <div className={styles.cardPrice}>
                      {listing.currency || "₦"}
                      {listing.price.toLocaleString()}
                    </div>
                  ) : (
                    <div className={styles.cardPrice}>
                      Contact for price
                    </div>
                  )}

                  <div className={styles.cardMeta}>
                    {[listing.category, listing.location]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>

                  <div className={styles.cardSeller}>
                    {business?.name ||
                      seller?.full_name ||
                      "Individual seller"}

                    {business?.verified && (
                      <span className={styles.verifiedMark}>
                        ✓
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyDiscovery}>
          <div className={styles.emptyDiscoveryIcon}>
            {query.trim() || category ? "🔎" : "🛍️"}
          </div>

          <h3>
            {query.trim() || category
              ? "No matching listings yet"
              : "Be part of the first discoveries"}
          </h3>

          <p>
            {query.trim() || category
              ? "Try another search or explore a different category."
              : "There are no listings yet. You could be among the first people to introduce something to Kinnect Marketplace."}
          </p>

          {query.trim() || category ? (
            <button
              type="button"
              className={styles.clearFiltersBtn}
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : (
            <Link
              href="/marketplace/new"
              className={styles.firstListingBtn}
            >
              Post the first listing
            </Link>
          )}
        </div>
      )}

      {cursor && listings.length > 0 && (
        <button
          type="button"
          className={styles.loadMoreBtn}
          onClick={handleLoadMore}
          disabled={loadingMore || searching}
        >
          {loadingMore ? "Loading..." : "Explore more"}
        </button>
      )}
    </div>
  );
}
