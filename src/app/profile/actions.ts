"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateAvatar(avatarUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return { success: true };
}

const USERNAME_CHANGE_COOLDOWN_DAYS = 30;
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export async function checkUsernameAvailable(username: string) {
  const clean = username.trim().toLowerCase();

  if (!USERNAME_REGEX.test(clean)) {
    return { available: false, reason: "3-20 characters, letters, numbers, and underscores only" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", clean)
    .maybeSingle();

  if (data && data.id !== user?.id) {
    return { available: false, reason: "That username is taken" };
  }

  return { available: true };
}

export async function setUsername(username: string) {
  const clean = username.trim().toLowerCase();
  const check = await checkUsernameAvailable(clean);
  if (!check.available) return { error: check.reason };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, username_updated_at")
    .eq("id", user.id)
    .single();

  if (profile?.username_updated_at) {
    const daysSince =
      (Date.now() - new Date(profile.username_updated_at).getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSince < USERNAME_CHANGE_COOLDOWN_DAYS) {
      const daysLeft = Math.ceil(USERNAME_CHANGE_COOLDOWN_DAYS - daysSince);
      return { error: `You can change your username again in ${daysLeft} day(s)` };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ username: clean, username_updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return { success: true, username: clean };
}

export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { error } = await admin.auth.admin.deleteUser(user!.id);

  if (error) {
    redirect(`/profile?error=${encodeURIComponent("Could not delete account: " + error.message)}`);
  }

  await supabase.auth.signOut();
  redirect("/login?deleted=true");
}

export async function updateCountry(country: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { error } = await supabase
    .from("profiles")
    .update({ country })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { success: true };
}