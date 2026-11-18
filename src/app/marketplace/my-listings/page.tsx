
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { getMyBusinesses, getMyListings } from "../actions";
import styles from "./page.module.css";

type SearchParams = {
  status?: string;
  business?: string;
  page?: string;
};

const statusFilters = [
  { value: "all", label: "All listings" },
  { value: "active", label: "Active" },
  { value: "sold", label: "Sold" },
  { value: "removed", label: "Removed" },
] as const;

function buildFilterHref(
  status: string,
  business: string,
  page = 1
) {
  const params = new URLSearchParams();

  if (status !== "all") params.set("status", status);
  if (business !== "all") params.set("business", business);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return `/marketplace/my-listings${query ? `?${query}` : ""}`;
}

export default async function MyListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const resolvedParams = await searchParams;

  const selectedStatus = statusFilters.some(
    (filter) => filter.value === resolvedParams.status
  )
    ? resolvedParams.status || "all"
    : "all";

  const businesses = await getMyBusinesses();

  const requestedBusiness = resolvedParams.business || "all";

  const selectedBusiness =
    requestedBusiness === "personal"
      ? "personal"
      : businesses.some((business) => business.id === requestedBusiness)
        ? requestedBusiness
        : "all";

  const requestedPage = Number(resolvedParams.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const result = await getMyListings({
    status: selectedStatus,
    businessId: selectedBusiness === "all" ? undefined : selectedBusiness,
    page,
  });

  const hasListings =
    result.counts.active + result.counts.sold + result.counts.removed > 0;

  return (
    <main className={styles.wrapper}>
      <AppHeader />

      <div className={styles.topBar}>
        <div>
          <Link href="/marketplace" className={styles.backLink}>
            ← Marketplace
          </Link>

          <h1 className={styles.heading}>My listings</h1>
          <p className={styles.subtitle}>
            Manage the products and services you&apos;re selling on Kinnect.
          </p>
        </div>

        <Link href="/marketplace/new" className={styles.createButton}>
          + Create listing
        </Link>
      </div>

      <section className={styles.summary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Active</span>
          <strong>{result.counts.active}</strong>
        </div>

        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Sold</span>
          <strong>{result.counts.sold}</strong>
        </div>

        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Removed</span>
          <strong>{result.counts.removed}</strong>
        </div>
      </section>

      <section className={styles.filters}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Status</span>

          <nav className={styles.filterLinks} aria-label="Filter by status">
            {statusFilters.map((filter) => (
              <Link
                key={filter.value}
                href={buildFilterHref(
                  filter.value,
                  selectedBusiness
                )}
                className={
                  selectedStatus === filter.value
                    ? styles.filterActive
                    : styles.filterLink
                }
                aria-current={
                  selectedStatus === filter.value ? "page" : undefined
                }
              >
                {filter.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Seller</label>

          <nav className={styles.filterLinks} aria-label="Filter by seller">
            <Link
              href={buildFilterHref(selectedStatus, "all")}
              className={
                selectedBusiness === "all"
                  ? styles.filterActive
                  : styles.filterLink
              }
              aria-current={
                selectedBusiness === "all" ? "page" : undefined
              }
            >
              All
            </Link>

            <Link
              href={buildFilterHref(selectedStatus, "personal")}
              className={
                selectedBusiness === "personal"
                  ? styles.filterActive
                  : styles.filterLink
              }
              aria-current={
                selectedBusiness === "personal" ? "page" : undefined
              }
            >
              Personal
            </Link>

            {businesses.map((business) => (
              <Link
                key={business.id}
                href={buildFilterHref(selectedStatus, business.id)}
                className={
                  selectedBusiness === business.id
                    ? styles.filterActive
                    : styles.filterLink
                }
                aria-current={
                  selectedBusiness === business.id ? "page" : undefined
                }
              >
                {business.name}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <div className={styles.resultsHeader}>
        <h2>
          {selectedStatus === "all"
            ? "All listings"
            : `${selectedStatus[0].toUpperCase()}${selectedStatus.slice(1)} listings`}
        </h2>

        <span>
          {result.total} {result.total === 1 ? "listing" : "listings"}
        </span>
      </div>

      {!hasListings ? (
        <div className={styles.emptyState}>
          <h2>You haven&apos;t listed anything yet</h2>
          <p>
            Your personal and business listings will appear here after you
            publish them.
          </p>
          <Link href="/marketplace/new" className={styles.createButton}>
            Create your first listing
          </Link>
        </div>
      ) : result.listings.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No listings in this view</h2>
          <p>Try another status or seller filter.</p>
          <Link
            href={buildFilterHref("all", "all")}
            className={styles.resetLink}
          >
            View all listings
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {result.listings.map((listing) => {
              const firstImage = listing.image_urls?.[0];
              const businessName = listing.business?.name;
              const statusClass =
                listing.status === "sold"
                  ? styles.sold
                  : listing.status === "removed"
                    ? styles.removed
                    : styles.active;

              return (
                <article className={styles.card} key={listing.id}>
                  <Link
                    href={`/marketplace/${listing.id}`}
                    className={styles.cardLink}
                  >
                    <div className={styles.imageWrap}>
                      {firstImage ? (
                        <img
                          src={firstImage}
                          alt={listing.title}
                          className={styles.image}
                        />
                      ) : (
                        <div className={styles.imagePlaceholder}>
                          No image
                        </div>
                      )}

                      <span className={`${styles.status} ${statusClass}`}>
                        {listing.status}
                      </span>
                    </div>

                    <div className={styles.cardBody}>
                      <h3 className={styles.cardTitle}>{listing.title}</h3>

                      {listing.price != null && (
                        <p className={styles.price}>
                          {listing.currency || "₦"}
                          {Number(listing.price).toLocaleString()}
                        </p>
                      )}

                      <p className={styles.category}>
                        {[listing.category, listing.location]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>

                      <p className={styles.sellerType}>
                        {businessName
                          ? `Business · ${businessName}`
                          : "Personal listing"}
                      </p>

                      <p className={styles.date}>
                        {listing.created_at
                          ? new Date(listing.created_at).toLocaleDateString()
                          : "Date unavailable"}
                      </p>
                    </div>
                  </Link>

                  <div className={styles.cardFooter}>
                    <Link href={`/marketplace/${listing.id}`}>
                      View listing
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {(result.hasPrevious || result.hasNext) && (
            <nav className={styles.pagination} aria-label="Listing pages">
              {result.hasPrevious ? (
                <Link
                  href={buildFilterHref(
                    selectedStatus,
                    selectedBusiness,
                    result.page - 1
                  )}
                  className={styles.pageButton}
                >
                  ← Previous
                </Link>
              ) : (
                <span />
              )}

              <span className={styles.pageNumber}>
                Page {result.page}
              </span>

              {result.hasNext ? (
                <Link
                  href={buildFilterHref(
                    selectedStatus,
                    selectedBusiness,
                    result.page + 1
                  )}
                  className={styles.pageButton}
                >
                  Next →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
