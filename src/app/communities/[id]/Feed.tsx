"use client";

import { useEffect, useRef, useState } from "react";
import { createPost } from "../actions";
import { uploadMedia } from "@/lib/media/uploadMedia";
import Avatar from "@/components/Avatar";
import styles from "./page.module.css";
import { createClient } from "@/lib/supabase/client";
import { Image as ImageIcon } from "lucide-react";
import { getPostSparks, toggleSpark } from "../actions";
import SparkButton from "@/components/SparkButton";
import SparkToast from "@/components/SparkToast";
import SponsoredBadge from "@/components/SponsoredBadge";

type Post = {
  id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  is_promoted?: boolean;
  promoted_until?: string | null;
  created_at: string;
  author: { id: string; full_name: string | null } | null;
  sparkedUserIds?: string[];
};

export default function Feed({
  communityId,
  currentUserId,
  currentUserName,
  initialPosts,
}: {
  communityId: string;
  currentUserId: string;
  currentUserName: string;
  initialPosts: Post[];
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const channelRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const avatarRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase  
      .channel(`community-feed-${communityId}`)
      .on("broadcast", { event: "new_post" }, (payload: any) => {
        const newPost = payload.payload as Post;
        setPosts((prev) => {
          if (prev.some((p) => p.id === newPost.id)) return prev;
          return [newPost, ...prev];
        });
      })

      .on("broadcast", { event: "spark_update" }, (payload) => {
        const { postId, sparkedUserIds, sparkerId, sparkerName, isAdding } =
          payload.payload as {
            postId: string;
            sparkedUserIds: string[];
            sparkerId: string;
            sparkerName: string;
            isAdding: boolean;
          };

        setPosts((prev) => {
          const target = prev.find((p) => p.id === postId);
          if (
            isAdding &&
            target?.author?.id === currentUserId &&
            sparkerId !== currentUserId
          ) {
            setToastMsg(`✦ ${sparkerName} sparked your post`);
            setTimeout(() => setToastMsg(null), 2600);
          }
          return prev.map((p) =>
            p.id === postId ? { ...p, sparkedUserIds } : p
          );
        });
      })

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [communityId]);


  useEffect(() => {
    async function loadSparks() {
      const postIds = posts.map((p) => p.id).filter((id) => !id.startsWith("temp-"));
      if (postIds.length === 0) return;

      const sparks = await getPostSparks(postIds);
      const byPost = new Map<string, string[]>();
      sparks.forEach((s) => {
        const list = byPost.get(s.post_id) || [];
        list.push(s.user_id);
        byPost.set(s.post_id, list);
      });

      setPosts((prev) =>
        prev.map((p) => ({
          ...p,
          sparkedUserIds: byPost.get(p.id) || p.sparkedUserIds || [],
        }))
      );
    }
    loadSparks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePost() {
    const content = text.trim();
    if (!content) return;
    setText("");

    const optimisticPost: Post = {
      id: `temp-${Date.now()}`,
      content,
      image_url: null,
      video_url: null,
      created_at: new Date().toISOString(),
      author: { id: currentUserId, full_name: currentUserName },
    };

    setPosts((prev) => [optimisticPost, ...prev]);

    channelRef.current?.send({
      type: "broadcast",
      event: "new_post",
      payload: optimisticPost,
    });

    await createPost(communityId, content);
  }

  async function handleSparkTap(post: Post) {
    const current = post.sparkedUserIds || [];
    const alreadySparked = current.includes(currentUserId);
    const isAdding = !alreadySparked;

    const updated = isAdding
      ? [...current, currentUserId]
      : current.filter((id) => id !== currentUserId);

    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, sparkedUserIds: updated } : p))
    );

    channelRef.current?.send({
      type: "broadcast",
      event: "spark_update",
      payload: {
        postId: post.id,
        sparkedUserIds: updated,
        sparkerId: currentUserId,
        sparkerName: currentUserName,
        isAdding,
      },
    });

    await toggleSpark(post.id);
  }

  async function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadError("");
    setUploading(true);

    const result = await uploadMedia("chat-images", communityId, file);

    if (result.error || !result.url) {
      setUploadError(result.error || "Upload failed");
      setUploading(false);
      return;
    }

    const optimisticPost: Post = {
      id: `temp-${Date.now()}`,
      content: "",
      image_url: result.type === "image" ? result.url : null,
      video_url: result.type === "video" ? result.url : null,
      created_at: new Date().toISOString(),
      author: { id: currentUserId, full_name: currentUserName },
    };

    setPosts((prev) => [optimisticPost, ...prev]);

    channelRef.current?.send({
      type: "broadcast",
      event: "new_post",
      payload: optimisticPost,
    });

    setUploading(false);
    await createPost(
      communityId,
      "",
      result.type === "image" ? result.url : undefined,
      result.type === "video" ? result.url : undefined
    );
  }

  return (
    <div>
      {toastMsg && <SparkToast message={toastMsg} />}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className={styles.fileInput}
        onChange={handleMediaSelect}
      />
      <div className={styles.postComposer}>
        <textarea
          className={styles.postInput}
          placeholder="Share something with the community..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className={styles.postImageBtn}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon size={18} />
        </button>
        <button className={styles.postBtn} onClick={handlePost}>
          Post
        </button>
      </div>

      {uploadError && <div className={styles.post}>{uploadError}</div>}
      {uploading && <div className={styles.post}>Uploading...</div>}

      {posts.length > 0 ? (
        posts.map((post) => (
          <div key={post.id} className={styles.post}>
            {post.is_promoted &&
              post.promoted_until &&
              new Date(post.promoted_until) > new Date() && <SponsoredBadge />}
            <div className={styles.postAuthor}>
              <div ref={(el) => { avatarRefs.current[post.id] = el; }}>
                <Avatar name={post.author?.full_name || "?"} size={32} />
              </div>
              <div>
                <div className={styles.postAuthorName}>
                  {post.author?.full_name || "Unknown"}
                </div>
                <div className={styles.postTime}>
                  {new Date(post.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
            {post.content && (
              <div className={styles.postContent}>{post.content}</div>
            )}
            {post.image_url && (
              <img src={post.image_url} alt="" className={styles.postImage} />
            )}
            {post.video_url && (
              <video
                src={post.video_url}
                controls
                className={styles.postVideo}
              />
            )}
            <SparkButton
              sparked={(post.sparkedUserIds || []).includes(currentUserId)}
              count={(post.sparkedUserIds || []).length}
              onTap={() => handleSparkTap(post)}
              getTarget={() => avatarRefs.current[post.id]}
            />
          </div>
        ))
      ) : (
        <p className={styles.empty}>No posts yet — be the first to share.</p>
      )}
    </div>
  );
}