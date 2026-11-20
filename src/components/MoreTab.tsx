"use client";

import { usePrivacy } from "@/lib/privacy";
import { PageHeader, NavRow, SectionTitle } from "@/components/ui/kit";

type Props = {
  shopUrl: string;
  credits: number;
  unrepliedReviews: number;
  onNavigate: (tab: string, extra?: Record<string, string>) => void;
  onRestartTour?: () => void;
  onLogout: () => void;
};

export default function MoreTab({ shopUrl, credits, unrepliedReviews, onNavigate, onRestartTour, onLogout }: Props) {
  const privacy = usePrivacy();
  return (
    <div className="flex flex-col gap-4 pb-24">
      <PageHeader title="More" subtitle="Grow your shop and manage your account" />

      <div className="flex flex-col gap-2">
        <SectionTitle>Grow</SectionTitle>
        <NavRow icon="fa-tags" title="Promotions" hint="Discounts, referral codes and loyalty rewards" onClick={() => onNavigate("promotions")} />
        <NavRow icon="fa-chart-line" title="Performance" hint="Sales, customers, busy days and what rents best" onClick={() => onNavigate("performance")} />
        <NavRow icon="fa-star" title="Reviews" hint="Read and reply to customer reviews" badge={unrepliedReviews ? `${unrepliedReviews} to reply` : undefined} onClick={() => onNavigate("reviews")} />
      </div>

      <div className="flex flex-col gap-2">
        <SectionTitle>Your shop page</SectionTitle>
        <NavRow icon="fa-store" title="Shop page" hint="Logo, About, posts, food partners and the order guide" onClick={() => onNavigate("shop")} />
        <NavRow icon="fa-external-link-alt" title="View your live shop" hint="Opens in a new tab" href={shopUrl} />
      </div>

      <div className="flex flex-col gap-2">
        <SectionTitle>Account</SectionTitle>
        <NavRow icon="fa-cog" title="Settings" hint="Booking rules, delivery, deposit, contact and invoices" onClick={() => onNavigate("settings")} />
        <NavRow icon="fa-coins" title="Credits" hint={privacy.on ? "Top up or invite a vendor" : `${credits} left · top up or invite a vendor`} onClick={() => onNavigate("settings", { group: "account", section: "credits" })} />
        {onRestartTour && <NavRow icon="fa-route" title="Replay the welcome tour" hint="A short walkthrough of the dashboard" onClick={onRestartTour} />}
        <NavRow icon="fa-power-off" title="Log out" tone="danger" onClick={onLogout} />
      </div>
    </div>
  );
}
