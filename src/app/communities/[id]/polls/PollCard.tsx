"use client";

import { useState } from "react";
import { voteOnPoll } from "../../actions";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type Option = { id: string; label: string; position: number };
type Vote = { id: string; option_id: string; user_id: string };

export default function PollCard({
  pollId,
  question,
  allowMultiple,
  options,
  initialVotes,
  currentUserId,
}: {
  pollId: string;
  question: string;
  allowMultiple: boolean;
  options: Option[];
  initialVotes: Vote[];
  currentUserId: string;
}) {
  const [votes, setVotes] = useState(initialVotes);

  const myVoteOptionIds = votes
    .filter((v) => v.user_id === currentUserId)
    .map((v) => v.option_id);

  const totalVotes = votes.length;

  async function handleVote(optionId: string) {
    const alreadySelected = myVoteOptionIds.includes(optionId);

    let updatedVotes: Vote[];
    if (alreadySelected) {
      updatedVotes = votes.filter(
        (v) => !(v.option_id === optionId && v.user_id === currentUserId)
      );
    } else if (allowMultiple) {
      updatedVotes = [
        ...votes,
        { id: `temp-${Date.now()}`, option_id: optionId, user_id: currentUserId },
      ];
    } else {
      updatedVotes = [
        ...votes.filter((v) => v.user_id !== currentUserId),
        { id: `temp-${Date.now()}`, option_id: optionId, user_id: currentUserId },
      ];
    }

    setVotes(updatedVotes);

    const supabase = createClient();
    supabase.channel(`community-polls-${pollId}`).send({
      type: "broadcast",
      event: "votes_updated",
      payload: { pollId, votes: updatedVotes },
    });

    await voteOnPoll(optionId, pollId, allowMultiple, myVoteOptionIds);
  }

  return (
    <div className={styles.pollCard}>
      <div className={styles.question}>{question}</div>
      <div className={styles.pollMeta}>
        {allowMultiple ? "Select all that apply" : "Select one"}
      </div>

      {options
        .sort((a, b) => a.position - b.position)
        .map((option) => {
          const optionVotes = votes.filter(
            (v) => v.option_id === option.id
          ).length;
          const percent =
            totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
          const isSelected = myVoteOptionIds.includes(option.id);

          return (
            <div
              key={option.id}
              className={styles.option}
              onClick={() => handleVote(option.id)}
            >
              <div
                className={`${styles.optionFill} ${
                  isSelected ? styles.optionFillSelected : ""
                }`}
                style={{ width: `${percent}%` }}
              />
              <div className={styles.optionContent}>
                <div className={styles.optionLabel}>
                  {isSelected && <span className={styles.checkMark}>✓</span>}
                  {option.label}
                </div>
                <div className={styles.optionStats}>
                  {percent}% ({optionVotes})
                </div>
              </div>
            </div>
          );
        })}

      <div className={styles.totalVotes}>{totalVotes} total votes</div>
    </div>
  );
}