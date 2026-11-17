// Shared admin types.

export type Badge = "verified" | "id_verified" | "top_rated" | "fast_responder" | "premium";

export type AdminVendor = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status?: "pending" | "approved" | "suspended" | string;
  credits?: number;
  slug?: string;
  image?: string;
  city?: string;
  areas?: string[];
  pickup?: string[];
  prospect_id?: string;
  badges?: Badge[];
  total_orders?: number;
  rating?: number;
  reviewCount?: number;
  avg_response_time?: number;
  is_mockup?: boolean;
  is_vacation?: boolean;
  referredBy?: string;
  referralRewarded?: boolean;
  createdAt?: unknown;
  joinedAt?: unknown;
};

export type AlertCounts = { applications: number; topUps: number; pendingOrders: number };
