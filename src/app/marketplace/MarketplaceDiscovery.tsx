
import Link from "next/link";
import SponsoredBadge from "@/components/SponsoredBadge";
import styles from "./page.module.css";

type DiscoveryListing = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  category: string | null;
  location: string | null;
  image_urls: string[] | null;
};

type DiscoveryBusiness = {
  id: string;
  name: string;
  category: string | null;
  logo_url: string | null;
  cover_color: string | null;
  location: string | null;
  verified: boolean | null;
};

function ListingSection({
  title,
  subtitle,
  listings,
  featured = false,
}: {
  title: string;
  subtitle: string;
  listings: DiscoveryListing[];
  featured?: boolean;
}) {
  if (listings.length === 0) return null;

  return (
    <section className={styles.discoverySection}>
      <div className={styles.discoverySectionHeader}>
        <div>
          <h2 className={styles.discoverySectionTitle}>{title}</h2>
          <p className={styles.discoverySectionSubtitle}>{subtitle}</p>
        </div>
      </div>

      <div className={styles.discoveryScroller}>
        {listings.map((listing) => (
          <Link
            key={listing.id}
            href={`/marketplace/${listing.id}`}
            className={styles.discoveryListingCard}
          >
            <div className={styles.discoveryImageWrap}>
              {listing.image_urls?.[0] ? (
                <img
                  src={listing.image_urls[0]}
                  alt={listing.title}
                  className={styles.discoveryImage}
                  loading="lazy"
                />
              ) : (
                <div className={styles.discoveryImagePlaceholder}>
                  🛍️
                </div>
              )}

              {featured && (
                <span className={styles.discoveryFeaturedBadge}>
                  <SponsoredBadge />
                </span>
              )}
            </div>

            <div className={styles.discoveryCardBody}>
              <div className={styles.discoveryCardTitle}>
                {listing.title}
              </div>

              <div className={styles.discoveryCardPrice}>
                {listing.price != null
                  ? `${listing.currency || "₦"}${listing.price.toLocaleString()}`
                  : "Contact for price"}
              </div>

              <div className={styles.discoveryCardMeta}>
                {[listing.category, listing.location]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function MarketplaceDiscovery({
  featured,
  local,
  businesses,
}: {
  featured: DiscoveryListing[];
  local: DiscoveryListing[];
  businesses: DiscoveryBusiness[];
}) {
  return (
    <div className={styles.discoveryFeed}>
      <ListingSection
        title="Featured discoveries"
        subtitle="Promoted listings worth taking a closer look at."
        listings={featured}
        featured
      />

      <ListingSection
        title="Around your region"
        subtitle="Discover what sellers near you are offering."
        listings={local}
      />

      {businesses.length > 0 && (
        <section className={styles.discoverySection}>
          <div className={styles.discoverySectionHeader}>
            <div>
              <h2 className={styles.discoverySectionTitle}>
                Businesses to discover
              </h2>
              <p className={styles.discoverySectionSubtitle}>
                Meet businesses and explore what they offer.
              </p>
            </div>

            <Link
              href="/business"
              className={styles.discoverySeeAll}
            >
              See all
            </Link>
          </div>

          <div className={styles.businessDiscoveryScroller}>
            {businesses.map((business) => (
              <Link
                key={business.id}
                href={`/business/${business.id}`}
                className={styles.businessDiscoveryCard}
              >
                <div
                  className={styles.businessDiscoveryCover}
                  style={{
                    background: business.cover_color || "#FF6F59",
                  }}
                >
                  {business.logo_url ? (
                    <img
                      src={business.logo_url}
                      alt=""
                      className={styles.businessDiscoveryLogo}
                      loading="lazy"
                    />
                  ) : (
                    <span>
                      {business.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className={styles.businessDiscoveryName}>
                  {business.name}

                  {business.verified && (
                    <span
                      className={styles.businessVerified}
                      aria-label="Verified business"
                    >
                      ✓
                    </span>
                  )}
                </div>

                <div className={styles.businessDiscoveryMeta}>
                  {[business.category, business.location]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
