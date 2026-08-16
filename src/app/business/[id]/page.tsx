import { getBusinessProfile } from "../actions";
import BackButton from "@/components/BackButton";
import styles from "./page.module.css";
import { getListings } from "@/app/marketplace/actions";
import Link from "next/link";

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getBusinessProfile(id);
  const catalog = business ? (await getListings({ businessId: id })).listings : [];

  if (!business) {
    return (
      <main className={styles.wrapper}>
        <BackButton href="/business" />
        <p>Business not found.</p>
        <div className={styles.catalogSection}>
        <div className={styles.catalogTitle}>Catalog</div>
        {catalog.length > 0 ? (
          <div className={styles.catalogGrid}>
            {catalog.map((item: any) => (
              <Link key={item.id} href={`/marketplace/${item.id}`}>
                {item.image_urls?.[0] ? (
                  <img
                    src={item.image_urls[0]}
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      objectFit: "cover",
                      borderRadius: "var(--radius-sm)",
                    }}
                    alt=""
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--pink-tint)",
                    }}
                  />
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            No items listed yet
          </p>
        )}
      </div>
      </main>
    );
  }

  return (
    <main className={styles.wrapper}>
      <BackButton href="/business" />
      <div
        className={styles.cover}
        style={{ background: business.cover_color || "#FF6F59" }}
      />
      <div className={styles.name}>
        {business.name}
        {business.verified && "✅"}
      </div>
      {business.category && (
        <div className={styles.category}>{business.category}</div>
      )}
      {business.description && (
        <div className={styles.description}>{business.description}</div>
      )}

      <div className={styles.infoCard}>
        {business.location && (
          <div className={styles.infoRow}>📍 {business.location}</div>
        )}
        {business.phone && <div className={styles.infoRow}>📞 {business.phone}</div>}
        {business.website_url && (
          <div className={styles.infoRow}>
            🔗{" "}
            <a href={business.website_url} target="_blank" rel="noopener noreferrer">
              {business.website_url}
            </a>
          </div>
        )}
      </div>
      
    </main>
  );
}