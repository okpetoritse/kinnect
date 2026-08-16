"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getMyBusinessProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  return data;
}

export async function getBusinessProfile(id: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return data;
}

export async function searchBusinesses(query: string) {
  const supabase = await createClient();

  let request = supabase
    .from("business_profiles")
    .select("id, name, category, logo_url, cover_color, location")
    .order("created_at", { ascending: false })
    .limit(30);

  if (query.trim()) {
    request = request.or(
      `name.ilike.%${query}%,category.ilike.%${query}%`
    );
  }

  const { data, error } = await request;
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

export async function createBusinessProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  const category = (formData.get("category") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const websiteUrl = (formData.get("websiteUrl") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const location = (formData.get("location") as string)?.trim();

  if (!name) {
    redirect(`/business/new?error=${encodeURIComponent("Business name is required")}`);
  }

  const { data: business, error } = await supabase
    .from("business_profiles")
    .insert({
      owner_id: user!.id,
      name,
      category: category || null,
      description: description || null,
      website_url: websiteUrl || null,
      phone: phone || null,
      location: location || null,
    })
    .select()
    .single();

  if (error || !business) {
    redirect(`/business/new?error=${encodeURIComponent(error?.message || "Could not create business profile")}`);
  }

  revalidatePath("/profile");
  redirect(`/business/${business!.id}`);
}