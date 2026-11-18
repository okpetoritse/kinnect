
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getBusinessProfile, updateBusinessProfile } from "../../actions";
import PageHeader from "@/components/PageHeader";
import BackButton from "@/components/BackButton";
import styles from "./page.module.css";

export default async function EditBusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: errorMessage } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const business = await getBusinessProfile(id);

  if (!business) notFound();

  if (business.owner_id !== user.id) {
    redirect(`/business/${id}`);
  }

  const updateAction = updateBusinessProfile.bind(
    null,
    business.id
  );

  return (
    <main className={styles.wrapper}>
      <BackButton href={`/business/${business.id}`} />

      <PageHeader title="Edit business details" />

      <p className={styles.intro}>
        Keep your business information accurate so customers know
        who they are dealing with.
      </p>

      {errorMessage && (
        <div className={styles.error} role="alert">
          {errorMessage}
        </div>
      )}

      <form action={updateAction} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="name" className={styles.label}>
            Business name
          </label>

          <input
            id="name"
            name="name"
            className={styles.input}
            defaultValue={business.name}
            maxLength={100}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="category" className={styles.label}>
            Business category
          </label>

          <input
            id="category"
            name="category"
            className={styles.input}
            defaultValue={business.category || ""}
            placeholder="e.g. Food, Fashion, Tech services"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="description" className={styles.label}>
            About your business
          </label>

          <textarea
            id="description"
            name="description"
            className={styles.textarea}
            defaultValue={business.description || ""}
            rows={5}
            placeholder="Describe your products, services and what makes your business useful to customers."
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="location" className={styles.label}>
            Location
          </label>

          <input
            id="location"
            name="location"
            className={styles.input}
            defaultValue={business.location || ""}
            placeholder="City, state or remote"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="phone" className={styles.label}>
            Business phone
          </label>

          <input
            id="phone"
            name="phone"
            type="tel"
            className={styles.input}
            defaultValue={business.phone || ""}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="websiteUrl" className={styles.label}>
            Business website
          </label>

          <input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            className={styles.input}
            defaultValue={business.website_url || ""}
            placeholder="https://example.com"
          />
        </div>

        <button type="submit" className={styles.submit}>
          Save business details
        </button>
      </form>
    </main>
  );
}
