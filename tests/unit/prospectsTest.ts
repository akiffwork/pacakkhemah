import {
  buildEnquiryMessage, buildOutreachMessage, formatDateRangeBM, joinBM,
  normalizeMyPhone, statsFor, waLink,
} from "@/lib/prospects";
import { resolveLocation } from "@/lib/malaysiaLocations";

describe("formatDateRangeBM", () => {
  it("formats single, same-month and cross-month ranges", () => {
    expect(formatDateRangeBM("2026-12-14", null)).toBe("14 Dis");
    expect(formatDateRangeBM("2026-12-14", "2026-12-14")).toBe("14 Dis");
    expect(formatDateRangeBM("2026-12-14", "2026-12-15")).toBe("14–15 Dis");
    expect(formatDateRangeBM("2026-12-30", "2027-01-02")).toBe("30 Dis – 2 Jan");
    expect(formatDateRangeBM(null, null)).toBe("");
  });
});

describe("joinBM", () => {
  it("joins with dan", () => {
    expect(joinBM(["khemah"])).toBe("khemah");
    expect(joinBM(["khemah", "dapur"])).toBe("khemah dan dapur");
    expect(joinBM(["khemah", "kerusi", "dapur"])).toBe("khemah, kerusi dan dapur");
  });
});

describe("buildEnquiryMessage", () => {
  it("builds the full message", () => {
    expect(buildEnquiryMessage("Camptastic", "Port Dickson", {
      pickupDate: "2026-12-14", returnDate: "2026-12-15", pax: 4, items: ["khemah", "dapur"],
    })).toBe(
      "Salam Camptastic, saya jumpa bisnes bos di Pacak Khemah (pacakkhemah.com). " +
      "Masih buat sewaan barang camping? Saya plan nak camping di Port Dickson, 14–15 Dis, 4 orang. " +
      "Kalau boleh nak khemah dan dapur.");
  });
  it("drops skipped parts cleanly", () => {
    expect(buildEnquiryMessage("Camptastic", "Port Dickson")).toBe(
      "Salam Camptastic, saya jumpa bisnes bos di Pacak Khemah (pacakkhemah.com). " +
      "Masih buat sewaan barang camping? Saya plan nak camping di Port Dickson.");
    expect(buildEnquiryMessage("A", "PD", { pax: 2 })).toContain("camping di PD, 2 orang.");
    expect(buildEnquiryMessage("A", "PD", { items: [] })).not.toContain("Kalau boleh");
  });
});

describe("phones", () => {
  it("normalises Malaysian numbers", () => {
    expect(normalizeMyPhone("012-345 6789")).toBe("60123456789");
    expect(normalizeMyPhone("+60 12-345 6789")).toBe("60123456789");
    expect(normalizeMyPhone("123456789")).toBe("60123456789");
    expect(waLink("0123456789", "a b")).toBe("https://wa.me/60123456789?text=a%20b");
  });
});

describe("resolveLocation", () => {
  it.each([
    ["port dickson", "Negeri Sembilan", "Port Dickson"],
    ["PD", "Negeri Sembilan", "Port Dickson"],
    ["Port Dickson ", "Negeri Sembilan", "Port Dickson"],
    ["camping teluk kemang", "Negeri Sembilan", "Port Dickson"],
    ["port klang", "Selangor", "Klang"],
    ["janda baik", "Pahang", "Bentong"],
    ["JB", "Johor", "Johor Bahru"],
    ["port dic", "Negeri Sembilan", "Port Dickson"],
  ])("%s → %s / %s", (q, state, district) => {
    expect(resolveLocation(q)).toEqual({ state, district });
  });
  it("resolves states without district", () => {
    expect(resolveLocation("negeri sembilan")).toEqual({ state: "Negeri Sembilan", district: undefined });
    expect(resolveLocation("penang")).toEqual({ state: "Pulau Pinang", district: undefined });
  });
  it("returns null for unknown text", () => {
    expect(resolveLocation("atlantis")).toBeNull();
    expect(resolveLocation("")).toBeNull();
  });
});

describe("statsFor + outreach", () => {
  it("aggregates clicks and builds the pitch", () => {
    const s = statsFor([
      { id: "1", prospectId: "p", searched: "pd", pax: 4, pickupDate: "2026-12-14", items: ["khemah"] },
      { id: "2", prospectId: "p", searched: "pd", pax: 6, pickupDate: "2026-12-20", items: ["khemah", "dapur"] },
      { id: "3", prospectId: "p", searched: "pd" },
    ]);
    expect(s.clicks).toBe(3);
    expect(s.pax).toBe(10);
    expect(s.topMonths).toEqual(["Dis"]);
    expect(s.topItems[0]).toBe("khemah");
    const msg = buildOutreachMessage({ name: "Camptastic", district: "Port Dickson", state: "Negeri Sembilan" }, s, "https://x/y");
    expect(msg).toContain("3 customer hubungi bos");
    expect(msg).toContain("total 10 orang");
    expect(msg).toContain("(kebanyakan Dis)");
    expect(msg).toContain("https://x/y");
  });
  it("omits demand line when there are no clicks", () => {
    const msg = buildOutreachMessage({ name: "A", state: "Perlis" }, statsFor([]), "u");
    expect(msg).not.toContain("customer hubungi");
  });
});
