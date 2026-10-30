"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestSiteOrigin } from "@/lib/notifications/requestSiteOrigin";
import { queuePush } from "@/lib/notifications/queuePush";
import { assertCanMessage } from "@/lib/messaging/assertCanMessage";

type CallType = "audio" | "video";
type InvitationStatus =
  | "accepted"
  | "declined"
  | "cancelled"
  | "missed"
  | "completed";

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getCallerName(user: {
  user_metadata?: Record<string, unknown>;
  email?: string;
}) {
  const metadataName = user.user_metadata?.full_name;
  return (
    (typeof metadataName === "string" && metadataName.trim()) ||
    user.email?.split("@")[0] ||
    "Someone"
  );
}

export async function createCallInvitation(
  friendId: string,
  callType: CallType
) {
  if (!validUuid(friendId)) return { error: "Invalid recipient." };
  if (callType !== "audio" && callType !== "video") {
    return { error: "Invalid call type." };
  }

  const supabase = await createClient();
  const guard = await assertCanMessage(supabase, friendId);
  if (!guard.ok) return { error: guard.error };

  const siteOrigin = await getRequestSiteOrigin();
  if (!siteOrigin) return { error: "Could not verify this Kinnect deployment." };

  const callerName = getCallerName(guard.user);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("call_invitations")
    .insert({
      caller_id: guard.user.id,
      callee_id: friendId,
      call_type: callType,
      caller_name: callerName,
      site_origin: siteOrigin,
      status: "preparing",
      expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[Call] Could not create invitation:", error);
    return { error: "Could not prepare the call invitation." };
  }

  return {
    success: true as const,
    invitationId: data.id as string,
    callerName,
  };
}

export async function publishCallInvitation(
  invitationId: string,
  offer: { type?: string; sdp?: string }
) {
  if (!validUuid(invitationId)) return { error: "Invalid call invitation." };
  if (
    !offer ||
    offer.type !== "offer" ||
    typeof offer.sdp !== "string" ||
    offer.sdp.length === 0 ||
    offer.sdp.length > 100_000
  ) {
    return { error: "The call offer is invalid." };
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return { error: "Please sign in again." };

  const siteOrigin = await getRequestSiteOrigin();
  if (!siteOrigin) return { error: "Could not verify this Kinnect deployment." };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: invitation, error: lookupError } = await admin
    .from("call_invitations")
    .select("id, caller_id, callee_id, call_type, caller_name, status, expires_at")
    .eq("id", invitationId)
    .eq("caller_id", user.id)
    .eq("site_origin", siteOrigin)
    .eq("status", "preparing")
    .gt("expires_at", now)
    .maybeSingle();

  if (lookupError || !invitation) {
    return { error: "This call invitation has expired or is no longer available." };
  }

  const expiresAt = new Date(Date.now() + 45_000).toISOString();

  const { data: updated, error: updateError } = await admin
    .from("call_invitations")
    .update({
      offer: { type: "offer", sdp: offer.sdp },
      status: "ringing",
      updated_at: now,
      expires_at: expiresAt,
    })
    .eq("id", invitationId)
    .eq("caller_id", user.id)
    .eq("site_origin", siteOrigin)
    .eq("status", "preparing")
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    console.error("[Call] Could not publish invitation:", updateError);
    return { error: "Could not publish the call invitation." };
  }

  // The invitation and SDP are committed before the push is queued.
  queuePush(
    invitation.callee_id as string,
    "Incoming call 📞",
    `${invitation.caller_name || "Someone"} is calling you`,
    `/messages/${user.id}?incomingCall=${invitationId}`,
    `kinnect:call:${invitationId}`,
    {
      type: "incoming-call",
      callInvitationId: invitationId,
      expiresAt,
    }
  );

  return { success: true as const, expiresAt };
}

export async function getPendingCallInvitation(friendId: string) {
  if (!validUuid(friendId)) return { invitation: null };

  const supabase = await createClient();
  const guard = await assertCanMessage(supabase, friendId);
  if (!guard.ok) return { invitation: null };

  const siteOrigin = await getRequestSiteOrigin();
  if (!siteOrigin) return { invitation: null };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("call_invitations")
    .select("id, caller_id, callee_id, call_type, caller_name, offer, expires_at")
    .eq("caller_id", friendId)
    .eq("callee_id", guard.user.id)
    .eq("site_origin", siteOrigin)
    .eq("status", "ringing")
    .gt("expires_at", new Date().toISOString())
    .not("offer", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Call] Pending invitation lookup failed:", error);
    return { invitation: null };
  }

  if (
    !data ||
    !data.offer ||
    typeof data.offer.sdp !== "string" ||
    data.offer.type !== "offer"
  ) {
    return { invitation: null };
  }

  return {
    invitation: {
      id: data.id as string,
      callerId: data.caller_id as string,
      callType: data.call_type as CallType,
      callerName: (data.caller_name as string) || "Someone",
      offer: {
        type: "offer" as const,
        sdp: data.offer.sdp as string,
      },
      expiresAt: data.expires_at as string,
    },
  };
}

export async function updateCallInvitationStatus(
  invitationId: string,
  status: InvitationStatus
) {
  if (!validUuid(invitationId)) return { error: "Invalid call invitation." };

  const allowedStatuses: InvitationStatus[] = [
    "accepted",
    "declined",
    "cancelled",
    "missed",
    "completed",
  ];
  if (!allowedStatuses.includes(status)) return { error: "Invalid call status." };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return { error: "Please sign in again." };

  const siteOrigin = await getRequestSiteOrigin();
  if (!siteOrigin) return { error: "Could not verify this Kinnect deployment." };

  const admin = createAdminClient();

  const { data: invitation, error: lookupError } = await admin
    .from("call_invitations")
    .select("id, caller_id, callee_id, status, expires_at")
    .eq("id", invitationId)
    .eq("site_origin", siteOrigin)
    .maybeSingle();

  if (lookupError || !invitation) {
    return { error: "Call invitation not found." };
  }

  const isCaller = invitation.caller_id === user.id;
  const isCallee = invitation.callee_id === user.id;
  const currentStatus = invitation.status as string;

  const expiresAtMs = Date.parse(invitation.expires_at);
  const invitationStillActive =
    Number.isFinite(expiresAtMs) && expiresAtMs > Date.now();

  const calleeTransition =
    isCallee &&
    currentStatus === "ringing" &&
    (status === "declined" ||
      (status === "accepted" && invitationStillActive));

  const callerTransition =
    isCaller &&
    ["preparing", "ringing"].includes(currentStatus) &&
    (status === "cancelled" || status === "missed");

  const completedTransition =
    (isCaller || isCallee) &&
    currentStatus === "accepted" &&
    status === "completed";

  if (!calleeTransition && !callerTransition && !completedTransition) {
    // Repeated termination events are harmless; do not overwrite a newer state.
    if (
      (status === "cancelled" && ["cancelled", "declined", "missed"].includes(currentStatus)) ||
      (status === "missed" && ["cancelled", "declined", "missed"].includes(currentStatus)) ||
      (status === "declined" && currentStatus === "declined") ||
      (status === "completed" && currentStatus === "completed")
    ) {
      return { success: true as const };
    }
    return { error: "This call can no longer change to that status." };
  }

  const now = new Date().toISOString();
  const update: Record<string, string> = {
    status,
    updated_at: now,
  };
  if (status === "accepted") update.answered_at = now;
  if (["declined", "cancelled", "missed", "completed"].includes(status)) {
    update.ended_at = now;
  }

  const { data: changed, error: updateError } = await admin
    .from("call_invitations")
    .update(update)
    .eq("id", invitationId)
    .eq("site_origin", siteOrigin)
    .eq("status", currentStatus)
    .select("id")
    .maybeSingle();

  if (updateError || !changed) {
    return { error: "The call status changed already. Refresh the call state." };
  }

  queuePush(
    invitation.callee_id as string,
    "",
    "",
    "/messages/" + invitation.caller_id,
    "kinnect:call:" + invitationId,
    {
      type: "call-ended",
      callInvitationId: invitationId,
    }
  );

  return { success: true as const };
}
