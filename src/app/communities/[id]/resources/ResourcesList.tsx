"use client";

import { useEffect, useRef, useState } from "react";
import { deleteResource } from "../../actions";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type Resource = {
  id: string;
  type: "link" | "file";
  title: string;
  url: string;
  description: string | null;
  added_by: string | null;
  created_at: string;
  addedBy: { id: string; full_name: string | null } | null;
};

export default function ResourcesList({
  communityId,
  currentUserId,
  currentUserName,
  initialResources,
}: {
  communityId: string;
  currentUserId: string;
  currentUserName: string;
  initialResources: Resource[];
}) {
  const [resources, setResources] = useState(initialResources);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`community-resources-${communityId}`)
      .on("broadcast", { event: "resource_added" }, (payload) => {
        const newResource = payload.payload as Resource;
        setResources((prev) => {
          if (prev.some((r) => r.id === newResource.id)) return prev;
          return [newResource, ...prev];
        });
      })
      .on("broadcast", { event: "resource_removed" }, (payload) => {
        const { id } = payload.payload as { id: string };
        setResources((prev) => prev.filter((r) => r.id !== id));
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [communityId]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);

    const supabase = createClient();
    const filePath = `${communityId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("community-resources")
      .upload(filePath, file);

    if (uploadError) {
      console.error(uploadError);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("community-resources").getPublicUrl(filePath);

    const { data, error } = await supabase
      .from("community_resources")
      .insert({
        community_id: communityId,
        added_by: currentUserId,
        type: "file",
        title: file.name,
        url: publicUrl,
      })
      .select(
        "id, type, title, url, description, added_by, created_at, addedBy:profiles!community_resources_added_by_fkey(id, full_name)"
      )
      .single();

    setUploading(false);

    if (!error && data) {
      setResources((prev) => [data as any, ...prev]);
      channelRef.current?.send({
        type: "broadcast",
        event: "resource_added",
        payload: data,
      });
    }
  }

  async function handleDelete(id: string) {
    setResources((prev) => prev.filter((r) => r.id !== id));
    channelRef.current?.send({
      type: "broadcast",
      event: "resource_removed",
      payload: { id },
    });
    await deleteResource(id, communityId);
  }

  return (
    <div className={styles.list}>
      <input
        ref={fileInputRef}
        type="file"
        className={styles.fileInput}
        onChange={handleFileSelect}
      />
      <button
        className={`${styles.addBtn} ${styles.uploadBtn}`}
        style={{ marginBottom: "16px" }}
        onClick={() => fileInputRef.current?.click()}
      >
        + Upload file
      </button>

      {uploading && (
        <div className={styles.resourceCard}>
          <div className={styles.resourceBody}>Uploading file...</div>
        </div>
      )}

      {resources.length > 0 ? (
        resources.map((r) => (
          <div key={r.id} className={styles.resourceCard}>
            <div
              className={`${styles.resourceIcon} ${
                r.type === "link" ? styles.resourceIconLink : styles.resourceIconFile
              }`}
            >
              {r.type === "link" ? "🔗" : "📄"}
            </div>
            <div className={styles.resourceBody}>
              <a href={r.url} target="_blank" rel="noopener noreferrer">
                <div className={styles.resourceTitle}>{r.title}</div>
              </a>
              {r.description && (
                <div className={styles.resourceDescription}>
                  {r.description}
                </div>
              )}
              <div className={styles.resourceMeta}>
                Added by {r.addedBy?.full_name || "Unknown"}
              </div>
            </div>
            {r.added_by === currentUserId && (
              <button
                className={styles.deleteBtn}
                onClick={() => handleDelete(r.id)}
              >
                Remove
              </button>
            )}
          </div>
        ))
      ) : (
        <p className={styles.empty}>
          No resources yet — add a link or upload a file.
        </p>
      )}
    </div>
  );
}