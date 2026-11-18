// src/lib/orderMessages.ts
// WhatsApp messages a vendor sends to a customer from the Orders tab.
// Each message exists in English and Bahasa Malaysia; the vendor picks the
// language per message. Greetings are neutral ("Hi").

import { type Order, getPayment, formatShortDate } from "@/lib/orderFlow";

export type MsgLang = "en" | "bm";

export type MsgKind =
  | "confirm" | "request_payment" | "request_balance" | "payment_received"
  | "agreement" | "pickup_reminder" | "gear_ready" | "return_reminder"
  | "deposit_settled" | "review" | "custom";

export type MsgContext = {
  vendorName: string;
  agreementLink?: string;
  reviewLink?: string;
};

export const MESSAGE_LABELS: Record<MsgKind, string> = {
  confirm: "Booking confirmed",
  request_payment: "Request payment",
  request_balance: "Request balance",
  payment_received: "Payment received",
  agreement: "Agreement link",
  pickup_reminder: "Pickup reminder",
  gear_ready: "Gear ready",
  return_reminder: "Return reminder",
  deposit_settled: "Deposit update",
  review: "Thank you and review",
  custom: "Custom message",
};

const BANK = { en: "[Your bank and account number]", bm: "[Bank dan nombor akaun anda]" };

function itemsLine(o: Order): string {
  return o.items.map(i => `${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""} x${i.qty}`).join(", ");
}

export function buildMessage(kind: MsgKind, lang: MsgLang, o: Order, ctx: MsgContext): string {
  const p = getPayment(o);
  const en = lang === "en";
  const name = o.customerName || (en ? "there" : "");
  const hi = `Hi${name ? ` ${name}` : ""},`;
  const items = itemsLine(o);
  const start = formatShortDate(o.bookingDates?.start);
  const end = formatShortDate(o.bookingDates?.end);
  const place = o.pickupLocation || (en ? "to be confirmed" : "akan disahkan");
  const isDelivery = o.fulfillmentType === "delivery";
  const sign = `\n\n${ctx.vendorName}`;

  const amounts = en
    ? `Rental: RM${p.rental}${p.deposit ? `\nSecurity deposit (refundable): RM${p.deposit}` : ""}\nTotal: RM${p.total}`
    : `Sewaan: RM${p.rental}${p.deposit ? `\nDeposit keselamatan (dipulangkan): RM${p.deposit}` : ""}\nJumlah: RM${p.total}`;

  switch (kind) {
    case "confirm":
      return en
        ? `${hi}\n\n*Your booking is confirmed.*\n\nItems: ${items}\nDates: ${start} to ${end}\n${amounts}\n\nTo lock the booking, please pay ${p.deposit ? `the deposit of RM${p.deposit} or the full RM${p.total}` : `RM${p.total}`} to:\n${BANK.en}\n\nPlease send the payment receipt here. Thank you!${sign}`
        : `${hi}\n\n*Tempahan anda telah disahkan.*\n\nItem: ${items}\nTarikh: ${start} hingga ${end}\n${amounts}\n\nUntuk kunci tempahan, sila bayar ${p.deposit ? `deposit RM${p.deposit} atau bayaran penuh RM${p.total}` : `RM${p.total}`} ke:\n${BANK.bm}\n\nSila hantar resit bayaran di sini. Terima kasih!${sign}`;
    case "request_payment":
      return en
        ? `${hi}\n\nA reminder about payment for your booking (${start} to ${end}).\n\n${amounts}\n\nPlease pay ${p.deposit ? `the deposit of RM${p.deposit} or the full RM${p.total}` : `RM${p.total}`} to:\n${BANK.en}\n\nPlease send the receipt here. Thank you!${sign}`
        : `${hi}\n\nPeringatan bayaran untuk tempahan anda (${start} hingga ${end}).\n\n${amounts}\n\nSila bayar ${p.deposit ? `deposit RM${p.deposit} atau bayaran penuh RM${p.total}` : `RM${p.total}`} ke:\n${BANK.bm}\n\nSila hantar resit di sini. Terima kasih!${sign}`;
    case "request_balance":
      return en
        ? `${hi}\n\nThe remaining balance for your booking (${start} to ${end}) is *RM${p.balanceDue}*.\n\nPlease pay before pickup to:\n${BANK.en}\n\nPlease send the receipt here. Thank you!${sign}`
        : `${hi}\n\nBaki bayaran untuk tempahan anda (${start} hingga ${end}) ialah *RM${p.balanceDue}*.\n\nSila jelaskan sebelum pickup ke:\n${BANK.bm}\n\nSila hantar resit di sini. Terima kasih!${sign}`;
    case "payment_received":
      return en
        ? `${hi}\n\n*Payment received, thank you.*\n\nYour booking is locked:\nItems: ${items}\nDates: ${start} to ${end}${p.balanceDue > 0 ? `\nBalance to pay: RM${p.balanceDue}` : ""}\n\nWe will contact you before the ${isDelivery ? "delivery" : "pickup"} date.${sign}`
        : `${hi}\n\n*Bayaran telah diterima, terima kasih.*\n\nTempahan anda telah dikunci:\nItem: ${items}\nTarikh: ${start} hingga ${end}${p.balanceDue > 0 ? `\nBaki perlu dibayar: RM${p.balanceDue}` : ""}\n\nKami akan hubungi anda sebelum tarikh ${isDelivery ? "penghantaran" : "pickup"}.${sign}`;
    case "agreement":
      return en
        ? `${hi}\n\nPlease complete the rental agreement for your booking:\n\n${ctx.agreementLink || ""}\n\n1. Enter your full name\n2. Enter your WhatsApp number\n3. Enter your IC or passport number\n4. Sign the agreement\n\nThank you!${sign}`
        : `${hi}\n\nSila lengkapkan perjanjian sewa untuk tempahan anda:\n\n${ctx.agreementLink || ""}\n\n1. Masukkan nama penuh\n2. Masukkan nombor WhatsApp\n3. Masukkan nombor IC atau pasport\n4. Tandatangan perjanjian\n\nTerima kasih!${sign}`;
    case "pickup_reminder":
      return en
        ? `${hi}\n\n*${isDelivery ? "Delivery" : "Pickup"} reminder*\n\nItems: ${items}\nDate: ${start}${o.timeSlot ? `\nTime: ${o.timeSlot}` : ""}\n${isDelivery ? "Address" : "Location"}: ${place}\n\nPlease let us know if anything changes. See you!${sign}`
        : `${hi}\n\n*Peringatan ${isDelivery ? "penghantaran" : "pickup"}*\n\nItem: ${items}\nTarikh: ${start}${o.timeSlot ? `\nMasa: ${o.timeSlot}` : ""}\n${isDelivery ? "Alamat" : "Lokasi"}: ${place}\n\nSila maklumkan jika ada perubahan. Jumpa nanti!${sign}`;
    case "gear_ready":
      return en
        ? `${hi}\n\n*Your gear is ready.*\n\n${items}\n\nEverything has been checked and is in good condition.\nDate: ${start}\n${isDelivery ? "Address" : "Location"}: ${place}\n\nHappy camping!${sign}`
        : `${hi}\n\n*Barang anda sudah siap.*\n\n${items}\n\nSemua item telah diperiksa dan dalam keadaan baik.\nTarikh: ${start}\n${isDelivery ? "Alamat" : "Lokasi"}: ${place}\n\nSelamat berkhemah!${sign}`;
    case "return_reminder":
      return en
        ? `${hi}\n\n*Return reminder*\n\nItems: ${items}\nReturn date: ${end}\nLocation: ${place}\n\nPlease make sure everything is clean and complete${p.depositHeld ? ` so we can refund your RM${p.deposit} deposit` : ""}. Thank you!${sign}`
        : `${hi}\n\n*Peringatan pemulangan*\n\nItem: ${items}\nTarikh pulang: ${end}\nLokasi: ${place}\n\nSila pastikan semua barang bersih dan lengkap${p.depositHeld ? ` supaya deposit RM${p.deposit} dapat dipulangkan` : ""}. Terima kasih!${sign}`;
    case "deposit_settled": {
      if (p.depositOutcome === "refunded") {
        return en
          ? `${hi}\n\nThank you for returning the gear. Your deposit of *RM${p.deposit}* has been refunded in full.${sign}`
          : `${hi}\n\nTerima kasih kerana memulangkan barang. Deposit anda *RM${p.deposit}* telah dipulangkan sepenuhnya.${sign}`;
      }
      const why = o.depositKeptReason ? (en ? ` (${o.depositKeptReason.toLowerCase()})` : ` (${o.depositKeptReason})`) : "";
      return en
        ? `${hi}\n\nThank you for returning the gear. From your RM${p.deposit} deposit, RM${p.depositKept} was kept${why} and *RM${p.depositRefunded}* has been refunded.${sign}`
        : `${hi}\n\nTerima kasih kerana memulangkan barang. Daripada deposit RM${p.deposit}, RM${p.depositKept} ditolak${why} dan *RM${p.depositRefunded}* telah dipulangkan.${sign}`;
    }
    case "review":
      return en
        ? `${hi}\n\nThanks for camping with ${ctx.vendorName}! We hope you had a great trip.\n\nIf you have a minute, please rate your rental:\n${ctx.reviewLink || ""}\n\nYour feedback helps other campers.${sign}`
        : `${hi}\n\nTerima kasih kerana menyewa dengan ${ctx.vendorName}! Semoga trip anda seronok.\n\nJika ada masa, sila beri ulasan sewaan anda:\n${ctx.reviewLink || ""}\n\nUlasan anda membantu campers lain.${sign}`;
    case "custom":
    default:
      return `${hi}\n\n`;
  }
}

/** wa.me link. Without a saved phone number WhatsApp asks the vendor to pick the contact. */
export function whatsappUrl(phone: string | undefined, message: string): string {
  const clean = (phone || "").replace(/[\s\-+()]/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}
