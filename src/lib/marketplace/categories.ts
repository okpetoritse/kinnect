
export const MARKETPLACE_CATEGORIES = [
  { value: "Phones & Electronics", icon: "📱" },
  { value: "Fashion & Accessories", icon: "👗" },
  { value: "Home & Living", icon: "🏠" },
  { value: "Food & Groceries", icon: "🍲" },
  { value: "Beauty & Personal Care", icon: "✨" },
  { value: "Health & Wellness", icon: "🌿" },
  { value: "Vehicles & Transport", icon: "🚗" },
  { value: "Property & Rentals", icon: "🏡" },
  { value: "Tech services", icon: "💻" },
  { value: "Professional Services", icon: "🛠️" },
  { value: "Education & Training", icon: "📚" },
  { value: "Events & Entertainment", icon: "🎟️" },
  { value: "Agriculture & Produce", icon: "🌾" },
  { value: "Other", icon: "🛍️" },
] as const;

export type MarketplaceCategory =
  (typeof MARKETPLACE_CATEGORIES)[number]["value"];

export const MARKETPLACE_CATEGORY_VALUES = MARKETPLACE_CATEGORIES.map(
  (category) => category.value
);
