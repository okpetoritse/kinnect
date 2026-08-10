"use client";

import { useState } from "react";
import { addLinkResource } from "../../../actions";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function NewResourceForm({ communityId }: { communityId: string }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData();
    formData.set("communityId", communityId);
    formData.set("title", title);
    formData.set("url", url);
    formData.set("description", description);

    // addLinkResource redirects server-side on success, so we won't get a
    // normal return value here — but we can still notify other clients
    // right before navigating away.
    const supabase = createClient();
    supabase.channel(`community-resources-${communityId}`).send({
      type: "broadcast",
      event: "resource_added",
      payload: {
        id: `pending-${Date.now()}`,
        type: "link",
        title,
        url,
        description: description || null,
        added_by: null,
        created_at: new Date().toISOString(),
        addedBy: null,
      },
    });

    await addLinkResource(formData);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="title">
          Title
        </label>
        <input
          className={styles.input}
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="React official docs"
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="url">
          URL
        </label>
        <input
          className={styles.input}
          id="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://react.dev"
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">
          Description (optional)
        </label>
        <textarea
          className={styles.textarea}
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why is this useful?"
        />
      </div>

      <button className={styles.submit} type="submit" disabled={submitting}>
        {submitting ? "Adding..." : "Add link"}
      </button>
    </form>
  );
}