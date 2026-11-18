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


export async function getMyBusinesses() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("business_profiles")
    .select(
      "id, owner_id, name, category, description, logo_url, cover_color, cover_image_url, location, verified, created_at"
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load your businesses:", error);
    return [];
  }

  return data || [];
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
  revalidatePath("/business");
  redirect(`/business/${business!.id}`);
}


export async function saveBusinessBrandAsset(
  businessId: string,
  assetType: "banner" | "logo",
  objectPath: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Please sign in again." };
  }

  if (assetType !== "banner" && assetType !== "logo") {
    return { error: "Invalid business image type." };
  }

  const expectedPrefix = `${businessId}/${assetType}/`;

  const validPath =
    objectPath.startsWith(expectedPrefix) &&
    objectPath.split("/").length === 3 &&
    /^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(
      objectPath.split("/")[2]
    );

  if (!validPath) {
    return { error: "Invalid business image path." };
  }

  // Independently verify ownership before updating the profile.
  const { data: business, error: ownershipError } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (ownershipError || !business) {
    return { error: "Business not found or you do not own it." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage
    .from("business-assets")
    .getPublicUrl(objectPath);

  const updates =
    assetType === "banner"
      ? { cover_image_url: publicUrl }
      : { logo_url: publicUrl };

  const { data: updatedBusiness, error } = await supabase
    .from("business_profiles")
    .update(updates)
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !updatedBusiness) {
    console.error("Could not save business branding:", error);

    return {
      error: error?.message || "Could not update business branding.",
    };
  }

  revalidatePath(`/business/${businessId}`);
  revalidatePath("/business");
  revalidatePath("/profile");
  revalidatePath("/marketplace");

  return {
    success: true,
    publicUrl,
  };
}



export async function updateBusinessProfile(
  businessId: string,
  formData: FormData
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const websiteInput = String(formData.get("websiteUrl") || "").trim();

  const errorUrl = `/business/${businessId}/edit?error=`;

  if (!name) {
    redirect(`${errorUrl}${encodeURIComponent("Business name is required.")}`);
  }

  if (name.length > 100) {
    redirect(`${errorUrl}${encodeURIComponent("Business name must be 100 characters or fewer.")}`);
  }

  let websiteUrl: string | null = null;

  if (websiteInput) {
    try {
      const parsed = new URL(websiteInput);

      if (!["https:", "http:"].includes(parsed.protocol)) {
        throw new Error("Invalid protocol");
      }

      websiteUrl = parsed.toString();
    } catch {
      redirect(`${errorUrl}${encodeURIComponent("Enter a valid website address beginning with https:// or http://.")}`);
    }
  }

  const { data: updatedBusiness, error } = await supabase
    .from("business_profiles")
    .update({
      name,
      category: category || null,
      description: description || null,
      location: location || null,
      phone: phone || null,
      website_url: websiteUrl,
    })
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !updatedBusiness) {
    console.error("Business profile update failed:", error);

    redirect(
      `${errorUrl}${encodeURIComponent(
        "Could not update this business. Check that you own it and try again."
      )}`
    );
  }

  revalidatePath(`/business/${businessId}`);
  revalidatePath("/business");
  revalidatePath("/profile");
  revalidatePath("/marketplace");

  redirect(`/business/${businessId}`);
}
