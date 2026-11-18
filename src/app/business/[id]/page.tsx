
import { createClient } from "@/lib/supabase/server";
import { getBusinessProfile } from "../actions";
import { getListings } from "@/app/marketplace/actions";
import BackButton from "@/components/BackButton";
import Link from "next/link";
import BusinessBrandingEditor from "./BusinessBrandingEditor";
import styles from "./page.module.css";

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const business = await getBusinessProfile(id);

  if (!business) {
    return (
      <main className={styles.wrapper}>
        <BackButton href="/business" />
        <p>Business not found.</p>
      </main>
    );
  }

  const isOwner = !!user && business.owner_id === user.id;

  const { listings: catalog } = await getListings({
    businessId: id,
    allRegions: true,
    sort: "newest",
  });

  const coverStyle = business.cover_image_url
    ? {
        backgroundColor: business.cover_color || "#FF6F59",
        backgroundImage: `linear-gradient(rgba(0,0,0,0.04), rgba(0,0,0,0.04)), url(${JSON.stringify(
          business.cover_image_url
        )})`,
      }
    : {
        backgroundColor: business.cover_color || "#FF6F59",
      };

  return (
    <main className={styles.wrapper}>
      <BackButton href="/business" />

      {/* Business cover banner */}
      <div
        className={styles.storefrontBanner}
        style={coverStyle}
        role="img"
        aria-label={`${business.name} business banner`}
      />

      {/* Business identity */}
      <div className={styles.businessIdentity}>
        <div
          className={styles.businessLogoWrap}
          style={{
            background: business.cover_color || "#FF6F59",
          }}
        >
          {business.logo_url ? (
            <img
              src={business.logo_url}
              className={styles.businessLogo}
              alt={`${business.name} logo`}
            />
          ) : (
            <span>
              {business.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className={styles.businessIdentityDetails}>
          <div className={styles.name}>
            {business.name}

            {business.verified && (
              <span
                className={styles.verified}
                aria-label="Verified business"
              >
                ✓
              </span>
            )}
          </div>

          {business.category && (
            <div className={styles.category}>
              {business.category}
            </div>
          )}

          {business.location && (
            <div className={styles.businessLocation}>
              📍 {business.location}
            </div>
          )}
        </div>
      </div>

      {business.description && (
        <div className={styles.description}>
          {business.description}
        </div>
      )}

      {/* Business contact information */}
      {(business.phone || business.website_url) && (
        <div className={styles.infoCard}>
          {business.phone && (
            <div className={styles.infoRow}>
              📞 {business.phone}
            </div>
          )}

          {business.website_url && (
            <div className={styles.infoRow}>
              🔗{" "}
              <a
                href={business.website_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {business.website_url}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Owner-only management */}
      {isOwner && (
        <div className={styles.ownerControls}>
          <div className={styles.ownerControlsHeader}>
            <h2>Manage your business</h2>
            <p>
              Manage your storefront and publish products or services.
            </p>
          </div>

          <Link
  href={`/business/${business.id}/edit`}
  className={styles.editBusinessButton}
>
  Edit business details
</Link>

          <Link
            href={`/marketplace/new?businessId=${encodeURIComponent(
              business.id
            )}`}
            className={styles.addBusinessListingButton}
          >
            + Add product or service
          </Link>

          <BusinessBrandingEditor
            businessId={business.id}
            bannerUrl={business.cover_image_url || null}
            logoUrl={business.logo_url || null}
          />
        </div>
      )}

      {/* Public business catalog */}
      <section className={styles.catalogSection}>
        <div className={styles.catalogHeader}>
          <h2 className={styles.catalogTitle}>
            Products &amp; services
          </h2>

          <span className={styles.catalogCount}>
            {catalog.length} shown
          </span>
        </div>

        {catalog.length > 0 ? (
          <div className={styles.catalogGrid}>
            {catalog.map((item) => {
              const imageUrl =
                Array.isArray(item.image_urls) &&
                typeof item.image_urls[0] === "string"
                  ? item.image_urls[0]
                  : null;

              return (
                <Link
                  key={item.id}
                  href={`/marketplace/${item.id}`}
                  className={styles.catalogCard}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      className={styles.catalogImage}
                      alt={item.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.catalogPlaceholder}>
                      🛍️
                    </div>
                  )}

                  <div className={styles.catalogItemTitle}>
                    {item.title}
                  </div>

                  <div className={styles.catalogItemPrice}>
                    {item.price != null
                      ? `${item.currency || "₦"}${item.price.toLocaleString()}`
                      : "Contact for price"}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className={styles.catalogEmpty}>
            {isOwner
              ? "Your business has no listings yet. Add your first product or service to get started."
              : "This business hasn't listed any products or services yet."}
          </div>
        )}
      </section>
    </main>
  );
}
