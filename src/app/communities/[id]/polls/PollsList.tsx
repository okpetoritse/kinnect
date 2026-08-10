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
};

export default function PollsList({
  polls,
  currentUserId,
}: {
  polls: Poll[];
  currentUserId: string;
}) {
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

  return (
    <>
      {polls.map((poll) => (
        <PollCard
          key={poll.id}
          pollId={poll.id}
          question={poll.question}
          allowMultiple={poll.allow_multiple}
          options={poll.options}
          initialVotes={pollVotes[poll.id] || []}
          currentUserId={currentUserId}
        />
      ))}
    </>
  );
}