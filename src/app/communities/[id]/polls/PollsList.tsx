"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PollCard from "./PollCard";
import styles from "./page.module.css";

type Poll = {
  id: string;
  question: string;
  allow_multiple: boolean;
  options: { id: string; label: string; position: number }[];
  votes: { id: string; option_id: string; user_id: string }[];
  created_at?: string;
};

export default function PollsList({
  polls,
  currentUserId,
}: {
  polls: Poll[];
  currentUserId: string;
}) {
  const [showOlder, setShowOlder] = useState(false);
  const [pollVotes, setPollVotes] = useState<Record<string, Poll["votes"]>>(
    Object.fromEntries(polls.map((p) => [p.id, p.votes]))
  );

  useEffect(() => {
    const supabase = createClient();
    const channels = polls.map((poll) =>
      supabase
        .channel(`community-polls-${poll.id}`)
        .on("broadcast", { event: "votes_updated" }, (payload) => {
          setPollVotes((prev) => ({
            ...prev,
            [payload.payload.pollId]: payload.payload.votes,
          }));
        })
        .subscribe()
    );

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [polls]);

  if (polls.length === 0) {
    return <p className={styles.empty}>No polls yet — create the first one.</p>;
  }

  // Sort newest-first and split by 7-day cutoff
  const sorted = [...polls].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
  );
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentPolls = sorted.filter(
    (p) => new Date(p.created_at || 0).getTime() > weekAgo
  );
  const olderPolls = sorted.filter(
    (p) => new Date(p.created_at || 0).getTime() <= weekAgo
  );

  const renderPollCard = (poll: Poll) => (
    <PollCard
      key={poll.id}
      pollId={poll.id}
      question={poll.question}
      allowMultiple={poll.allow_multiple}
      options={poll.options}
      initialVotes={pollVotes[poll.id] || []}
      currentUserId={currentUserId}
    />
  );

  return (
    <div className={styles.pollsWrapper}>
      {recentPolls.map(renderPollCard)}

      {olderPolls.length > 0 && (
        <>
          <button
            className={styles.olderToggle}
            onClick={() => setShowOlder((p) => !p)}
          >
            {showOlder ? "▲" : "▼"} Older polls ({olderPolls.length})
          </button>
          {showOlder && olderPolls.map(renderPollCard)}
        </>
      )}
    </div>
  );
}