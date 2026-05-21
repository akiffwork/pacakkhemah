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
