"use client";

import { useEffect, useState } from "react";
import { claimTask, unclaimTask, updateTaskStatus } from "../../actions";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  due_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  assignee: { id: string; full_name: string | null } | null;
  created_at?: string;
};

// Only show active columns on the main board
const COLUMNS: { key: Task["status"]; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
];

const NEXT_STATUS: Record<Task["status"], Task["status"] | null> = {
  todo: "in_progress",
  in_progress: "done",
  done: null,
};

const NEXT_LABEL: Record<Task["status"], string> = {
  todo: "Start",
  in_progress: "Mark done",
  done: "",
};

export default function TaskBoard({
  communityId,
  currentUserId,
  currentUserName,
  initialTasks,
}: {
  communityId: string;
  currentUserId: string;
  currentUserName: string;
  initialTasks: Task[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`community-tasks-${communityId}`)
      .on("broadcast", { event: "task_updated" }, (payload) => {
        const updated = payload.payload as Task;
        setTasks((prev) => {
          const exists = prev.some((t) => t.id === updated.id);
          if (exists) {
            return prev.map((t) => (t.id === updated.id ? updated : t));
          }
          return [updated, ...prev];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [communityId]);

  function broadcastUpdate(task: Task) {
    const supabase = createClient();
    supabase.channel(`community-tasks-${communityId}`).send({
      type: "broadcast",
      event: "task_updated",
      payload: task,
    });
  }

  async function handleClaim(task: Task) {
    const updated: Task = {
      ...task,
      assigned_to: currentUserId,
      assignee: { id: currentUserId, full_name: currentUserName },
    };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    broadcastUpdate(updated);
    await claimTask(task.id);
  }

  async function handleUnclaim(task: Task) {
    const updated: Task = { ...task, assigned_to: null, assignee: null };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    broadcastUpdate(updated);
    await unclaimTask(task.id);
  }

  async function handleAdvance(task: Task) {
    const nextStatus = NEXT_STATUS[task.status];
    if (!nextStatus) return;
    const updated: Task = { ...task, status: nextStatus };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    broadcastUpdate(updated);
    await updateTaskStatus(task.id, nextStatus);
  }

  // Separate completed tasks and sort newest-first
  const completedTasks = tasks
    .filter((t) => t.status === "done")
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );

  // Reusable card component
  const renderTaskCard = (task: Task) => {
    const isOverdue =
      task.due_date &&
      new Date(task.due_date) < new Date() &&
      task.status !== "done";

    return (
      <div key={task.id} className={styles.taskCard}>
        <div className={styles.taskTop}>
          <div className={styles.taskTitle}>{task.title}</div>
          <div
            className={`${styles.priorityBadge} ${
              task.priority === "high"
                ? styles.priorityHigh
                : task.priority === "low"
                ? styles.priorityLow
                : styles.priorityMedium
            }`}
          >
            {task.priority}
          </div>
        </div>

        {task.description && (
          <div className={styles.taskDescription}>{task.description}</div>
        )}

        <div className={styles.taskMeta}>
          {task.due_date ? (
            <div
              className={`${styles.dueDate} ${
                isOverdue ? styles.dueDateOverdue : ""
              }`}
            >
              Due{" "}
              {new Date(task.due_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </div>
          ) : (
            <div />
          )}

          {task.assignee ? (
            <div className={styles.assignee}>
              <div className={styles.assigneeAvatar}>
                {(task.assignee.full_name || "?").charAt(0).toUpperCase()}
              </div>
              <span className={styles.assigneeName}>
                {task.assignee.full_name}
              </span>
            </div>
          ) : (
            <button
              className={styles.claimBtn}
              onClick={() => handleClaim(task)}
            >
              Claim
            </button>
          )}
        </div>

        <div className={styles.taskActions}>
          {task.assigned_to === currentUserId && (
            <button
              className={styles.actionBtn}
              onClick={() => handleUnclaim(task)}
            >
              Unclaim
            </button>
          )}
          {NEXT_STATUS[task.status] && (
            <button
              className={styles.actionBtn}
              onClick={() => handleAdvance(task)}
            >
              {NEXT_LABEL[task.status]}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.boardWrapper}>
      <div className={styles.columns}>
        {COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className={styles.column}>
              <div className={styles.columnTitle}>
                {col.label}
                <span className={styles.columnCount}>{columnTasks.length}</span>
              </div>

              {columnTasks.length > 0 ? (
                columnTasks.map(renderTaskCard)
              ) : (
                <p className={styles.emptyColumn}>Nothing here</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Collapsible section for completed tasks */}
      {completedTasks.length > 0 && (
        <div className={styles.completedSection}>
          <button
            className={styles.completedToggle}
            onClick={() => setShowCompleted((p) => !p)}
          >
            {showCompleted ? "▲" : "▼"} Completed ({completedTasks.length})
          </button>

          {showCompleted && (
            <div className={styles.completedList}>
              {completedTasks.map(renderTaskCard)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}