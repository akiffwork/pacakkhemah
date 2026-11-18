import { buildInvoiceNumber, formatMYR, buildInvoiceMeta } from "@/lib/invoicePDF";

describe("buildInvoiceNumber", () => {
  it("produces INV-PK- prefix with 8 uppercased chars from orderId", () => {
    const result = buildInvoiceNumber("abc123xyz987");
    expect(result).toBe("INV-PK-ABC123XY");
  });

  it("handles short orderId gracefully", () => {
    const result = buildInvoiceNumber("abc");
    expect(result).toBe("INV-PK-ABC");
  });
});

describe("formatMYR", () => {
  it("formats to 2 decimal places", () => {
    expect(formatMYR(100)).toBe("100.00");
    expect(formatMYR(50.5)).toBe("50.50");
    expect(formatMYR(0)).toBe("0.00");
  });
});

describe("buildInvoiceMeta", () => {
  it("returns invoiceNo, dateStr, timeStr from a Date", () => {
    const d = new Date("2026-05-21T10:30:00+08:00");
    const meta = buildInvoiceMeta(d, "abc123xyz987");
    expect(meta.invoiceNo).toBe("INV-PK-ABC123XY");
    expect(meta.dateStr).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(meta.timeStr).toMatch(/\d{2}:\d{2}/);
  });
});

import { invoiceFromOrder, paymentStatus, buildInvoiceHTML } from "@/lib/invoicePDF";
import { getPayment, type Order } from "@/lib/orderFlow";

const baseOrder = {
  id: "q1niudho1234", customerName: "ILI SHAFIQAH", customerPhone: "60139577945", pickupLocation: "Balok", status: "completed",
  bookingDates: { start: "2026-05-16", end: "2026-05-17" }, nights: 1, createdAt: new Date("2026-05-08T14:38:00Z"),
  items: [{ name: "Vidalido Cabin XL Package", qty: 1, price: 160, lineTotal: 160, addSetup: true, setupFee: 30 }],
  freeItems: [{ name: "Lantern", qty: 1 }],
  subtotal: 160, promoCode: "PACKAGEISGOOD", promoDiscount: 16, setupFeeTotal: 30,
  totalAmount: 224, depositAmount: 50, rentalAmount: 174,
  paymentV2: true, depositReceivedAt: 1, rentalReceivedAt: 1, depositOutcome: "refunded",
} as unknown as Order;
const vendor = { name: "Camping Dengan Kita", slug: "camping-dengan-kita", image: "https://cdn.example/logo.png", phone: "60132404336", city: "Kuantan", ig: "campkita", taxProfile: { tin: "IG123", legalName: "ATAKASEN ENTERPRISE" } };

describe("paymentStatus", () => {
  const st = (o: Partial<Order>) => paymentStatus(getPayment({ ...baseOrder, ...o } as Order));
  it("refunded deposit", () => expect(st({})).toMatchObject({ tone: "paid", title: "Paid · Deposit refunded", figure: 174 }));
  it("kept deposit", () => expect(st({ depositOutcome: "kept" })).toMatchObject({ title: "Paid · Deposit kept", figure: 224 }));
  it("paid in full, deposit held", () => expect(st({ depositOutcome: undefined })).toMatchObject({ title: "Paid in full", figure: 224 }));
  it("partly paid", () => expect(st({ depositOutcome: undefined, rentalReceivedAt: undefined })).toMatchObject({ tone: "partial", figure: 174 }));
  it("nothing paid", () => expect(st({ depositOutcome: undefined, rentalReceivedAt: undefined, depositReceivedAt: undefined })).toMatchObject({ tone: "due", figure: 224 }));
});

describe("buildInvoiceHTML", () => {
  const h = buildInvoiceHTML(invoiceFromOrder(baseOrder, vendor));
  it("has the agreement-style header and footer", () => {
    expect(h).toContain('src="https://cdn.example/logo.png"');
    expect(h).toContain("pacakkhemah.com/shop/camping-dengan-kita");
    expect(h).toContain("@campkita");
    expect(h).toMatch(/class="hdr"[\s\S]*class="ftr"/);
    expect(h).toContain("@page { size: A4; margin: 0; }");
    expect(h).toContain("INV-PK-Q1NIUDHO");
  });
  it("items match the cart, including setup and free items", () => {
    for (const t of ["Vidalido Cabin XL Package", "RM 160/night × 1 × 1N", "Add-on: setup at campsite", "FREE ITEM", "PACKAGEISGOOD", "Setup fee", "Security deposit (refundable)", "RM 224", "SST"]) expect(h).toContain(t);
  });
  it("shows supplier tax details and payment status", () => {
    for (const t of ["ATAKASEN ENTERPRISE", "t/a Camping Dengan Kita", "IG123", "Paid · Deposit refunded", "Balance due"]) expect(h).toContain(t);
  });
  it("escapes customer text", () => {
    const x = buildInvoiceHTML(invoiceFromOrder({ ...baseOrder, customerName: "<script>x</script>" } as Order, vendor));
    expect(x).not.toContain("<script>x");
  });
});
