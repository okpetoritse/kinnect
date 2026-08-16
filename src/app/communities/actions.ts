"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendPushToUser } from "@/lib/notifications/sendPush";

export async function createCommunity(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/communities/new?error=${encodeURIComponent("Not logged in")}`);
  }

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const isGoal = formData.get("isGoal") === "on";
  const goalMetricLabel = (formData.get("goalMetricLabel") as string)?.trim();
  const goalTarget = formData.get("goalTarget") as string;
  const goalDeadline = formData.get("goalDeadline") as string;

  if (!name) {
    redirect(`/communities/new?error=${encodeURIComponent("Community name is required")}`);
  }
  if (isGoal && (!goalMetricLabel || !goalTarget)) {
    redirect(`/communities/new?error=${encodeURIComponent("Goal communities need a unit and a target")}`);
  }

  const { data: community, error } = await supabase
    .from("communities")
    .insert({
      name,
      description,
      created_by: user!.id,
      is_goal: isGoal,
      goal_metric_label: isGoal ? goalMetricLabel : null,
      goal_target: isGoal ? Number(goalTarget) : null,
      goal_deadline: isGoal && goalDeadline ? goalDeadline : null,
    })
    .select()
    .single();

  if (error || !community) {
    redirect(`/communities/new?error=${encodeURIComponent(error?.message || "Could not create community")}`);
  }

  const { error: memberError } = await supabase
    .from("community_members")
    .insert({
      community_id: community!.id,
      user_id: user!.id,
      role: "admin",
    });

  if (memberError) {
    redirect(`/communities/new?error=${encodeURIComponent(memberError.message)}`);
  }

  revalidatePath("/communities");
  redirect(`/communities/${community!.id}`);
}

export async function joinCommunity(communityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { error } = await supabase.from("community_members").insert({
    community_id: communityId,
    user_id: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/communities/${communityId}`);
  revalidatePath("/communities");
  return { success: true };
}

export async function getCommunityPosts(communityId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("community_posts")
    .select(
      "id, content, image_url, video_url, is_promoted, promoted_until, created_at, author:profiles!community_posts_author_id_fkey(id, full_name)"
    )
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  const now = new Date();
  const normalized = (data || []).map((p: any) => ({
    ...p,
    author: Array.isArray(p.author) ? p.author[0] : p.author,
  }));

  const activePromoted = normalized.filter(
    (p) => p.is_promoted && p.promoted_until && new Date(p.promoted_until) > now
  );
  const rest = normalized.filter((p) => !(p.is_promoted && p.promoted_until && new Date(p.promoted_until) > now));

  return [...activePromoted, ...rest];
}

export async function createPost(
  communityId: string,
  content: string,
  imageUrl?: string,
  videoUrl?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || (!content.trim() && !imageUrl && !videoUrl)) {
    return { error: "Invalid post" };
  }

  const { error } = await supabase.from("community_posts").insert({
    community_id: communityId,
    author_id: user.id,
    content: content.trim(),
    image_url: imageUrl || null,
    video_url: videoUrl || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/communities/${communityId}`);
  return { success: true };
}

export async function getCommunityMessages(communityId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("community_messages")
    .select(
      "id, sender_id, content, image_url, video_url, sticker_id, created_at, sender:profiles!community_messages_sender_id_fkey(id, full_name)"
    )
    .eq("community_id", communityId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return (data || []).map((m: any) => ({
    ...m,
    sender: Array.isArray(m.sender) ? m.sender[0] : m.sender,
  }));
}

export async function sendCommunityMessage(
  communityId: string,
  content: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !content.trim()) return { error: "Invalid message" };

  const { error } = await supabase.from("community_messages").insert({
    community_id: communityId,
    sender_id: user.id,
    content: content.trim(),
  });

  if (error) return { error: error.message };

  const { data: members } = await supabase
    .from("community_members")
    .select("user_id")
    .eq("community_id", communityId)
    .neq("user_id", user.id);

  (members || []).forEach((m) =>
    sendPushToUser(
      m.user_id,
      "New community message",
      content.slice(0, 100),
      `/communities/${communityId}/chat`
    )
  );

  return { success: true };
}

export async function sendCommunityMediaMessage(
  communityId: string,
  url: string,
  type: "image" | "video"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { error } = await supabase.from("community_messages").insert({
    community_id: communityId,
    sender_id: user.id,
    content: "",
    image_url: type === "image" ? url : null,
    video_url: type === "video" ? url : null,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function sendCommunityStickerMessage(
  communityId: string,
  stickerId: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { error } = await supabase.from("community_messages").insert({
    community_id: communityId,
    sender_id: user.id,
    content: "",
    sticker_id: stickerId,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function getCommunityEvents(communityId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("community_events")
    .select("id, title, description, event_date, location, created_by")
    .eq("community_id", communityId)
    .order("event_date", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function getEventRsvps(eventIds: string[]) {
  if (eventIds.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("community_event_rsvps")
    .select("event_id, user_id, status")
    .in("event_id", eventIds);

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function createEvent(formData: FormData) {
  const communityId = formData.get("communityId") as string;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/communities/${communityId}/calendar/new?error=${encodeURIComponent("Not logged in")}`);
  }

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const eventDate = formData.get("eventDate") as string;
  const location = (formData.get("location") as string)?.trim();

  if (!title || !eventDate) {
    redirect(`/communities/${communityId}/calendar/new?error=${encodeURIComponent("Title and date are required")}`);
  }

  const { error } = await supabase.from("community_events").insert({
    community_id: communityId,
    created_by: user!.id,
    title,
    description: description || null,
    event_date: new Date(eventDate).toISOString(),
    location: location || null,
  });

  if (error) {
    redirect(`/communities/${communityId}/calendar/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/communities/${communityId}/calendar`);
  redirect(`/communities/${communityId}/calendar`);
}

export async function setRsvp(eventId: string, status: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { error } = await supabase.from("community_event_rsvps").upsert(
    {
      event_id: eventId,
      user_id: user.id,
      status,
    },
    { onConflict: "event_id,user_id" }
  );

  if (error) return { error: error.message };

  return { success: true };
}

export async function getCommunityTasks(communityId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("community_tasks")
    .select(
      "id, title, description, status, priority, due_date, assigned_to, created_by, assignee:profiles!community_tasks_assigned_to_fkey(id, full_name)"
    )
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function createTask(formData: FormData) {
  const communityId = formData.get("communityId") as string;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/communities/${communityId}/tasks/new?error=${encodeURIComponent("Not logged in")}`);
  }

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const priority = formData.get("priority") as string;
  const dueDate = formData.get("dueDate") as string;

  if (!title) {
    redirect(`/communities/${communityId}/tasks/new?error=${encodeURIComponent("Title is required")}`);
  }

  const { error } = await supabase.from("community_tasks").insert({
    community_id: communityId,
    created_by: user!.id,
    title,
    description: description || null,
    priority: priority || "medium",
    due_date: dueDate ? new Date(dueDate).toISOString() : null,
  });

  if (error) {
    redirect(`/communities/${communityId}/tasks/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/communities/${communityId}/tasks`);
  redirect(`/communities/${communityId}/tasks`);
}

export async function claimTask(taskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { error } = await supabase
    .from("community_tasks")
    .update({ assigned_to: user.id, updated_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function unclaimTask(taskId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("community_tasks")
    .update({ assigned_to: null, updated_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function updateTaskStatus(taskId: string, status: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("community_tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) return { error: error.message };
  return { success: true };
}
export async function getCommunityPolls(communityId: string) {
  const supabase = await createClient();

  const { data: polls, error } = await supabase
    .from("community_polls")
    .select("id, question, allow_multiple, created_at")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });

  if (error || !polls) {
    console.error(error);
    return [];
  }

  const pollIds = polls.map((p) => p.id);
  if (pollIds.length === 0) return [];

  const { data: options } = await supabase
    .from("community_poll_options")
    .select("id, poll_id, label, position")
    .in("poll_id", pollIds)
    .order("position", { ascending: true });

  const { data: votes } = await supabase
    .from("community_poll_votes")
    .select("id, poll_id, option_id, user_id")
    .in("poll_id", pollIds);

  return polls.map((poll) => ({
    ...poll,
    options: (options || []).filter((o) => o.poll_id === poll.id),
    votes: (votes || []).filter((v) => v.poll_id === poll.id),
  }));
}

export async function createPoll(formData: FormData) {
  const communityId = formData.get("communityId") as string;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/communities/${communityId}/polls/new?error=${encodeURIComponent("Not logged in")}`);
  }

  const question = (formData.get("question") as string)?.trim();
  const allowMultiple = formData.get("allowMultiple") === "on";
  const optionLabels = formData
    .getAll("options")
    .map((o) => (o as string).trim())
    .filter(Boolean);

  if (!question || optionLabels.length < 2) {
    redirect(`/communities/${communityId}/polls/new?error=${encodeURIComponent("Question and at least 2 options are required")}`);
  }

  const { data: poll, error } = await supabase
    .from("community_polls")
    .insert({
      community_id: communityId,
      created_by: user!.id,
      question,
      allow_multiple: allowMultiple,
    })
    .select()
    .single();

  if (error || !poll) {
    redirect(`/communities/${communityId}/polls/new?error=${encodeURIComponent(error?.message || "Could not create poll")}`);
  }

  const { error: optionsError } = await supabase
    .from("community_poll_options")
    .insert(
      optionLabels.map((label, i) => ({
        poll_id: poll!.id,
        label,
        position: i,
      }))
    );

  if (optionsError) {
    redirect(`/communities/${communityId}/polls/new?error=${encodeURIComponent(optionsError.message)}`);
  }

  revalidatePath(`/communities/${communityId}/polls`);
  redirect(`/communities/${communityId}/polls`);
}

export async function voteOnPoll(
  optionId: string,
  pollId: string,
  allowMultiple: boolean,
  myCurrentVoteOptionIds: string[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const alreadyVotedThis = myCurrentVoteOptionIds.includes(optionId);

  if (alreadyVotedThis) {
    // Toggle off
    const { error } = await supabase
      .from("community_poll_votes")
      .delete()
      .eq("option_id", optionId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    return { success: true };
  }

  // If single-choice, clear any existing vote on other options for this poll first
  if (!allowMultiple && myCurrentVoteOptionIds.length > 0) {
    await supabase
      .from("community_poll_votes")
      .delete()
      .eq("poll_id", pollId)
      .eq("user_id", user.id);
  }

  const { error } = await supabase.from("community_poll_votes").insert({
    poll_id: pollId,
    option_id: optionId,
    user_id: user.id,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function getCommunityResources(communityId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("community_resources")
    .select(
      "id, type, title, url, description, added_by, created_at, addedBy:profiles!community_resources_added_by_fkey(id, full_name)"
    )
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function addLinkResource(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const communityId = formData.get("communityId") as string;
  const title = (formData.get("title") as string)?.trim();
  const url = (formData.get("url") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();

  if (!title || !url) return { error: "Title and URL are required" };

  const { error } = await supabase.from("community_resources").insert({
    community_id: communityId,
    added_by: user.id,
    type: "link",
    title,
    url,
    description: description || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/communities/${communityId}/resources`);
  redirect(`/communities/${communityId}/resources`);
}

export async function deleteResource(resourceId: string, communityId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("community_resources")
    .delete()
    .eq("id", resourceId);

  if (error) return { error: error.message };

  revalidatePath(`/communities/${communityId}/resources`);
  return { success: true };
}
export async function getCommunityLeaderboard(communityId: string) {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("community_members")
    .select("user_id, profile:profiles!community_members_user_id_fkey(id, full_name)")
    .eq("community_id", communityId);

  const { data: posts } = await supabase
    .from("community_posts")
    .select("author_id")
    .eq("community_id", communityId);

  const { data: doneTasks } = await supabase
    .from("community_tasks")
    .select("assigned_to")
    .eq("community_id", communityId)
    .eq("status", "done");

  const { data: messages } = await supabase
    .from("community_messages")
    .select("sender_id")
    .eq("community_id", communityId);

  const { data: events } = await supabase
    .from("community_events")
    .select("created_by")
    .eq("community_id", communityId);

  function countBy(rows: any[] | null, key: string) {
    const map = new Map<string, number>();
    (rows || []).forEach((row) => {
      const id = row[key];
      if (!id) return;
      map.set(id, (map.get(id) || 0) + 1);
    });
    return map;
  }

  const postCounts = countBy(posts, "author_id");
  const taskCounts = countBy(doneTasks, "assigned_to");
  const messageCounts = countBy(messages, "sender_id");
  const eventCounts = countBy(events, "created_by");

  const leaderboard = (members || []).map((m) => {
    const userId = m.user_id;
    const postsCount = postCounts.get(userId) || 0;
    const tasksCount = taskCounts.get(userId) || 0;
    const messagesCount = messageCounts.get(userId) || 0;
    const eventsCount = eventCounts.get(userId) || 0;

    const points =
      postsCount * 5 + tasksCount * 10 + messagesCount * 1 + eventsCount * 5;

    const achievements = [];
    if (postsCount >= 1) achievements.push({ icon: "🌱", label: "First Post" });
    if (messagesCount >= 20)
      achievements.push({ icon: "💬", label: "Conversation Starter" });
    if (tasksCount >= 5) achievements.push({ icon: "✅", label: "Task Master" });
    if (eventsCount >= 1)
      achievements.push({ icon: "📅", label: "Event Organizer" });
    if (points >= 100)
      achievements.push({ icon: "🏆", label: "Community Pillar" });

    return {
      userId,
      name: (m.profile as any)?.full_name || "Unknown",
      points,
      postsCount,
      tasksCount,
      messagesCount,
      eventsCount,
      achievements,
    };
  });

  return leaderboard.sort((a, b) => b.points - a.points);
}

export async function getCommunityMembersWithFriendStatus(communityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: members } = await supabase
    .from("community_members")
    .select("user_id, profile:profiles!community_members_user_id_fkey(id, full_name, username, avatar_url)")
    .eq("community_id", communityId);

  const { data: friendRows } = await supabase
    .from("friend_requests")
    .select("sender_id, receiver_id, status")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

  return (members || [])
    .filter((m) => m.user_id !== user.id)
    .map((m) => {
      const relevant = (friendRows || []).find(
        (f) =>
          (f.sender_id === user.id && f.receiver_id === m.user_id) ||
          (f.receiver_id === user.id && f.sender_id === m.user_id)
      );

      let friendStatus: "none" | "pending" | "friends" = "none";
      if (relevant?.status === "accepted") friendStatus = "friends";
      else if (relevant?.status === "pending") friendStatus = "pending";

      return {
        userId: m.user_id,
        profile: m.profile as any,
        friendStatus,
      };
    });
}

export async function logGoalProgress(
  communityId: string,
  value: number,
  note: string,
  mediaUrl?: string,
  mediaType?: "image" | "video"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { error } = await supabase.from("community_goal_progress").insert({
    community_id: communityId,
    user_id: user.id,
    value,
    note: note || null,
    media_url: mediaUrl || null,
    media_type: mediaType || null,
  });

  if (error) return { error: error.message };

  const { data: community } = await supabase
    .from("communities")
    .select("goal_target")
    .eq("id", communityId)
    .single();

  const target = community?.goal_target || 0;
  const newPercent = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;

  revalidatePath(`/communities/${communityId}/progress`);
  return { success: true, newPercent };
}

const MILESTONE_THRESHOLDS = [25, 50, 75, 100];

export async function getGoalLeaderboard(communityId: string) {
  const supabase = await createClient();

  const { data: community } = await supabase
    .from("communities")
    .select("goal_target, goal_metric_label")
    .eq("id", communityId)
    .single();

  const { data: members } = await supabase
    .from("community_members")
    .select("user_id, profile:profiles!community_members_user_id_fkey(id, full_name, avatar_url)")
    .eq("community_id", communityId);

  const { data: allProgress } = await supabase
    .from("community_goal_progress")
    .select("user_id, value, note, created_at")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });

  const latestByUser = new Map<string, { value: number; note: string | null; created_at: string }>();
  (allProgress || []).forEach((row) => {
    if (!latestByUser.has(row.user_id)) {
      latestByUser.set(row.user_id, row);
    }
  });

  const target = community?.goal_target || 0;

  const leaderboard = (members || []).map((m) => {
    const latest = latestByUser.get(m.user_id);
    const value = latest?.value || 0;
    const percent = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;

    const milestonesReached = MILESTONE_THRESHOLDS.filter((t) => percent >= t);

    return {
      userId: m.user_id,
      name: (m.profile as any)?.full_name || "Unknown",
      avatarUrl: (m.profile as any)?.avatar_url || null,
      value,
      percent,
      milestonesReached,
      lastUpdate: latest?.created_at || null,
    };
  });

  return {
    goalTarget: target,
    goalMetricLabel: community?.goal_metric_label || "",
    milestoneThresholds: MILESTONE_THRESHOLDS,
    leaderboard: leaderboard.sort((a, b) => b.percent - a.percent),
  };
}

export async function getPostSparks(postIds: string[]) {
  if (postIds.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("community_post_sparks")
    .select("post_id, user_id")
    .in("post_id", postIds);

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function toggleSpark(postId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { data: existing } = await supabase
    .from("community_post_sparks")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("community_post_sparks")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);

    return { sparked: false };
  }

  await supabase.from("community_post_sparks").insert({
    post_id: postId,
    user_id: user.id,
  });

  // Get the post author and community, then send notification
  const { data: post } = await supabase
    .from("community_posts")
    .select("author_id, community_id")
    .eq("id", postId)
    .single();

  if (post) {
    sendPushToUser(
      post.author_id,
      "New spark ✦",
      "Someone sparked your post",
      `/communities/${post.community_id}`
    );
  }

  return { sparked: true };
}

export async function getMessageSparks(messageIds: string[]) {
  if (messageIds.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("community_message_sparks")
    .select("message_id, user_id")
    .in("message_id", messageIds);

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function toggleMessageSpark(messageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { data: existing } = await supabase
    .from("community_message_sparks")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("community_message_sparks")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", user.id);
    return { sparked: false };
  }

  await supabase.from("community_message_sparks").insert({
    message_id: messageId,
    user_id: user.id,
  });
  return { sparked: true };
}

export async function getCommunitiesList(cursor?: string, query?: string) {
  const supabase = await createClient();
  const PAGE_SIZE = 20;

  let request = supabase
    .from("communities")
    .select("id, name, description, cover_color, is_goal, created_at")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    request = request.lt("created_at", cursor);
  }
  if (query && query.trim()) {
    request = request.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
  }

  const { data: communities, error } = await request;
  if (error || !communities) {
    console.error(error);
    return { communities: [], memberCounts: {}, nextCursor: null };
  }

  const ids = communities.map((c) => c.id);
  const { data: memberRows } = ids.length
    ? await supabase.from("community_members").select("community_id").in("community_id", ids)
    : { data: [] };

  const memberCounts: Record<string, number> = {};
  (memberRows || []).forEach((m) => {
    memberCounts[m.community_id] = (memberCounts[m.community_id] || 0) + 1;
  });

  const nextCursor =
    communities.length === PAGE_SIZE
      ? communities[communities.length - 1].created_at
      : null;

  return { communities, memberCounts, nextCursor };
}