"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

type FAQItem = { question: string; answer: string };
type FAQSection = { title: string; icon: string; items: FAQItem[] };

type AboutContent = {
  story: string;
  whatWeDo: string;
  forCampers: string;
  forVendors: string;
  whyChooseUs: { title: string; desc: string; icon: string }[];
  mission: string;
  contactEmail: string;
  contactWhatsApp: string;
};

type HomepageContent = {
  heroTitle: string;
  heroSubtitle: string;
  heroCta: string;
  bannerEnabled: boolean;
  bannerText: string;
  bannerLink: string;
};

type FooterContent = {
  companyName: string;
  copyright: string;
  links: { label: string; url: string }[];
  socialLinks: { platform: string; url: string }[];
};

type ContentData = {
  about: AboutContent;
  faq: FAQSection[];
  homepage: HomepageContent;
  footer: FooterContent;
};

const DEFAULT_CONTENT: ContentData = {
  about: {
    story: "Pacak Khemah was born out of a passion for the outdoors and a desire to make camping accessible to everyone. We noticed a gap between people who wanted to experience the beauty of nature and the local vendors who own high-quality camping gear. Our platform acts as the digital bridge that connects these two worlds.",
    whatWeDo: "We provide a comprehensive multi-vendor ecosystem specifically designed for the camping community.",
    forCampers: "We offer a seamless \"browse and book\" experience. From tents and power stations to complete camping packages, users can find everything they need in one place and communicate directly with vendors via WhatsApp.",
    forVendors: "We provide a powerful \"Vendor Studio\" Command Center. Our tools allow gear owners to manage inventory, track analytics, set custom rental policies, and even verify customer identities through digital agreements.",
    whyChooseUs: [
      { title: "Local Expertise", desc: "We empower local gear owners and small businesses to reach a wider audience.", icon: "fa-map-marker-alt" },
      { title: "Simplified Logistics", desc: "With dynamic pickup hubs and integrated rental steps, we take the stress out of gear coordination.", icon: "fa-truck" },
      { title: "Security & Trust", desc: "Our platform features built-in identity verification and standardized legal agreements to protect both the owner and the renter.", icon: "fa-shield-alt" },
      { title: "Transparent Pricing", desc: "We support complex discounting rules, including nightly bulk discounts and promo codes, ensuring customers always get the best deal.", icon: "fa-tags" },
    ],
    mission: "To become the ultimate companion for every outdoor enthusiast in Malaysia. Whether you are a first-time camper or a seasoned trekker, Pacak Khemah is here to ensure you have the right gear for your next adventure.",
    contactEmail: "hello@pacakkhemah.com",
    contactWhatsApp: "60123456789",
  },
  faq: [
    {
      title: "General Questions",
      icon: "fa-circle-question",
      items: [
        { question: "What is Pacak Khemah?", answer: "Pacak Khemah is Malaysia's dedicated multi-vendor camping gear rental platform. We connect outdoor enthusiasts with local gear owners, making it easier to rent high-quality equipment like tents, power stations, and complete camping sets for your next adventure." },
        { question: "Is Pacak Khemah a rental shop?", answer: "No. We are a technology platform that hosts multiple independent vendors. When you rent gear, you are renting directly from the shop owner (Vendor) listed on the page." },
      ]
    },
    {
      title: "For Customers",
      icon: "fa-user",
      items: [
        { question: "How do I make a booking?", answer: "1) Browse the gear on a vendor's storefront. 2) Select your \"Pickup\" and \"Return\" dates to check real-time availability. 3) Add items to your cart and click \"Submit Order via WhatsApp.\" 4) You will be connected directly to the vendor to finalize details and confirm availability." },
        { question: "Why do I need to upload my IC/ID?", answer: "To ensure the security of high-value equipment, vendors require identity verification. After the vendor confirms your booking, they will send you a link to a secure digital agreement where you will upload a photo of your ID (Front & Back) and sign the rental terms." },
        { question: "Is my personal data safe?", answer: "Yes. Your ID copies are stored in a secure, restricted folder. Only the specific vendor you are renting from can view your documents, and they are used solely for rental verification purposes." },
        { question: "How do I pay for my rental?", answer: "Payment is handled directly between you and the vendor. Most vendors accept bank transfers or E-Wallets. Details will be provided during your WhatsApp conversation." },
        { question: "Is there a security deposit?", answer: "Yes. Most vendors require a refundable security deposit. The amount depends on the vendor's policy (either a fixed RM amount or a percentage of the total rental). This is clearly displayed in your cart summary during the checkout process." },
      ]
    },
    {
      title: "For Vendors",
      icon: "fa-store",
      items: [
        { question: "How do I list my gear?", answer: "Once you have a Vendor account, log in to your Vendor Studio. In the \"Inventory\" tab, you can add items, set prices, upload photos, and manage stock levels." },
        { question: "How do I verify a customer?", answer: "In your Vendor Studio, navigate to the \"Documents\" tab. Copy your unique Verification Link and send it to your customer via WhatsApp. Once they sign and upload their ID, their record will instantly appear in your dashboard for you to view or download as a PDF." },
        { question: "How do I manage my availability?", answer: "Use the Calendar feature in your dashboard to block out dates when gear is already rented or when your shop is closed. This prevents customers from selecting unavailable dates on your storefront." },
        { question: "What happens if gear is damaged?", answer: "Your digital rental agreement includes dynamic \"House Rules\" that you can customize in your Settings. These terms legally bind the customer to your damage and loss policies. You can use the signed PDF copy as a record of the agreement." },
      ]
    },
    {
      title: "Cancellations & Refunds",
      icon: "fa-rotate-left",
      items: [
        { question: "What is the cancellation policy?", answer: "Since every vendor is independent, cancellation policies may vary. Please check the \"Terms of Service\" section on the vendor's storefront or ask them directly via WhatsApp before finalizing your payment." },
      ]
    },
  ],
  homepage: {
    heroTitle: "Sewa Gear Camping Malaysia",
    heroSubtitle: "Cari peralatan camping dari vendor dipercayai di seluruh Malaysia",
    heroCta: "Cari Vendor",
    bannerEnabled: false,
    bannerText: "",
    bannerLink: "",
  },
  footer: {
    companyName: "Pacak Khemah",
    copyright: "© 2026 Pacak Khemah. All Rights Reserved.",
    links: [
      { label: "About", url: "/about" },
      { label: "FAQ", url: "/faq" },
      { label: "Directory", url: "/directory" },
    ],
    socialLinks: [],
  },
};

export default function ContentTab() {
  const [content, setContent] = useState<ContentData>(DEFAULT_CONTENT);
  const [activeSection, setActiveSection] = useState<"about" | "faq" | "homepage" | "footer">("about");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingFaqSection, setEditingFaqSection] = useState<number | null>(null);
  const [editingFaqItem, setEditingFaqItem] = useState<{ section: number; item: number } | null>(null);

  useEffect(() => {
    loadContent();
  }, []);

  async function loadContent() {
    try {
      const snap = await getDoc(doc(db, "settings", "content"));
      if (snap.exists()) {
        setContent({ ...DEFAULT_CONTENT, ...snap.data() as ContentData });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveContent() {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "content"), content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      alert("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function updateAbout(field: keyof AboutContent, value: any) {
    setContent(prev => ({ ...prev, about: { ...prev.about, [field]: value } }));
  }

  function updateHomepage(field: keyof HomepageContent, value: any) {
    setContent(prev => ({ ...prev, homepage: { ...prev.homepage, [field]: value } }));
  }

  function updateFooter(field: keyof FooterContent, value: any) {
    setContent(prev => ({ ...prev, footer: { ...prev.footer, [field]: value } }));
  }

  function updateWhyChooseUs(index: number, field: string, value: string) {
    const updated = [...content.about.whyChooseUs];
    updated[index] = { ...updated[index], [field]: value };
    updateAbout("whyChooseUs", updated);
  }

  function addWhyChooseUs() {
    updateAbout("whyChooseUs", [...content.about.whyChooseUs, { title: "", desc: "", icon: "fa-star" }]);
  }

  function removeWhyChooseUs(index: number) {
    updateAbout("whyChooseUs", content.about.whyChooseUs.filter((_, i) => i !== index));
  }

  function updateFaqSection(sectionIndex: number, field: string, value: string) {
    const updated = [...content.faq];
    updated[sectionIndex] = { ...updated[sectionIndex], [field]: value };
    setContent(prev => ({ ...prev, faq: updated }));
  }

  function addFaqSection() {
    setContent(prev => ({
      ...prev,
      faq: [...prev.faq, { title: "New Section", icon: "fa-question", items: [] }]
    }));
  }

  function removeFaqSection(index: number) {
    setContent(prev => ({ ...prev, faq: prev.faq.filter((_, i) => i !== index) }));
  }

  function updateFaqItem(sectionIndex: number, itemIndex: number, field: string, value: string) {
    const updated = [...content.faq];
    updated[sectionIndex].items[itemIndex] = { ...updated[sectionIndex].items[itemIndex], [field]: value };
    setContent(prev => ({ ...prev, faq: updated }));
  }

  function addFaqItem(sectionIndex: number) {
    const updated = [...content.faq];
    updated[sectionIndex].items.push({ question: "", answer: "" });
    setContent(prev => ({ ...prev, faq: updated }));
  }

  function removeFaqItem(sectionIndex: number, itemIndex: number) {
    const updated = [...content.faq];
    updated[sectionIndex].items = updated[sectionIndex].items.filter((_, i) => i !== itemIndex);
    setContent(prev => ({ ...prev, faq: updated }));
  }

  function updateFooterLink(index: number, field: string, value: string) {
    const updated = [...content.footer.links];
    updated[index] = { ...updated[index], [field]: value };
    updateFooter("links", updated);
  }

  function addFooterLink() {
    updateFooter("links", [...content.footer.links, { label: "", url: "" }]);
  }

  function removeFooterLink(index: number) {
    updateFooter("links", content.footer.links.filter((_, i) => i !== index));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fas fa-spinner fa-spin text-2xl text-slate-300"></i>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          { id: "about", label: "About Page", icon: "fa-info-circle" },
          { id: "faq", label: "FAQ", icon: "fa-question-circle" },
          { id: "homepage", label: "Homepage", icon: "fa-home" },
          { id: "footer", label: "Footer", icon: "fa-shoe-prints" },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeSection === tab.id
                ? "bg-[#062c24] text-white"
                : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <i className={`fas ${tab.icon}`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* About Page Editor */}
      {activeSection === "about" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Our Story</h3>
            <textarea
              value={content.about.story}
              onChange={e => updateAbout("story", e.target.value)}
              rows={4}
              className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm outline-none focus:border-emerald-300 resize-none"
              placeholder="Tell your story..."
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">What We Do</h3>
            <textarea
              value={content.about.whatWeDo}
              onChange={e => updateAbout("whatWeDo", e.target.value)}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm outline-none focus:border-emerald-300 resize-none mb-4"
              placeholder="What do you do..."
            />
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">For Campers</label>
                <textarea
                  value={content.about.forCampers}
                  onChange={e => updateAbout("forCampers", e.target.value)}
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300 resize-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">For Vendors</label>
                <textarea
                  value={content.about.forVendors}
                  onChange={e => updateAbout("forVendors", e.target.value)}
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300 resize-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-black text-[#062c24] uppercase">Why Choose Us</h3>
              <button onClick={addWhyChooseUs} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100">
                + Add Point
              </button>
            </div>
            <div className="space-y-3">
              {content.about.whyChooseUs.map((item, i) => (
                <div key={i} className="flex gap-3 items-start bg-slate-50 p-4 rounded-xl">
                  <input
                    value={item.icon}
                    onChange={e => updateWhyChooseUs(i, "icon", e.target.value)}
                    className="w-24 bg-white border border-slate-200 p-2 rounded-lg text-xs outline-none"
                    placeholder="fa-icon"
                  />
                  <div className="flex-1 space-y-2">
                    <input
                      value={item.title}
                      onChange={e => updateWhyChooseUs(i, "title", e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm font-bold outline-none"
                      placeholder="Title"
                    />
                    <input
                      value={item.desc}
                      onChange={e => updateWhyChooseUs(i, "desc", e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm outline-none"
                      placeholder="Description"
                    />
                  </div>
                  <button onClick={() => removeWhyChooseUs(i)} className="text-slate-300 hover:text-red-500 p-2">
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Our Mission</h3>
            <textarea
              value={content.about.mission}
              onChange={e => updateAbout("mission", e.target.value)}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm outline-none focus:border-emerald-300 resize-none"
              placeholder="Your mission statement..."
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Contact Info</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Email</label>
                <input
                  value={content.about.contactEmail}
                  onChange={e => updateAbout("contactEmail", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300"
                  placeholder="hello@example.com"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">WhatsApp Number</label>
                <input
                  value={content.about.contactWhatsApp}
                  onChange={e => updateAbout("contactWhatsApp", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300"
                  placeholder="60123456789"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Editor */}
      {activeSection === "faq" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{content.faq.length} sections, {content.faq.reduce((a, s) => a + s.items.length, 0)} questions</p>
            <button onClick={addFaqSection} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg hover:bg-emerald-100">
              + Add Section
            </button>
          </div>

          {content.faq.map((section, sectionIdx) => (
            <div key={sectionIdx} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <input
                    value={section.icon}
                    onChange={e => updateFaqSection(sectionIdx, "icon", e.target.value)}
                    className="w-28 bg-white border border-slate-200 p-2 rounded-lg text-xs outline-none"
                    placeholder="fa-icon"
                  />
                  <input
                    value={section.title}
                    onChange={e => updateFaqSection(sectionIdx, "title", e.target.value)}
                    className="flex-1 bg-white border border-slate-200 p-2 rounded-lg text-sm font-bold outline-none"
                    placeholder="Section Title"
                  />
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <button onClick={() => addFaqItem(sectionIdx)} className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100">
                    + Question
                  </button>
                  <button onClick={() => removeFaqSection(sectionIdx)} className="text-slate-300 hover:text-red-500 p-2">
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {section.items.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No questions yet. Click "+ Question" to add one.</p>
                ) : (
                  section.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="bg-slate-50 p-4 rounded-xl">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                          <input
                            value={item.question}
                            onChange={e => updateFaqItem(sectionIdx, itemIdx, "question", e.target.value)}
                            className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm font-bold outline-none"
                            placeholder="Question"
                          />
                          <textarea
                            value={item.answer}
                            onChange={e => updateFaqItem(sectionIdx, itemIdx, "answer", e.target.value)}
                            rows={3}
                            className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm outline-none resize-none"
                            placeholder="Answer"
                          />
                        </div>
                        <button onClick={() => removeFaqItem(sectionIdx, itemIdx)} className="text-slate-300 hover:text-red-500 p-2">
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Homepage Editor */}
      {activeSection === "homepage" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Hero Section</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Title</label>
                <input
                  value={content.homepage.heroTitle}
                  onChange={e => updateHomepage("heroTitle", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300"
                  placeholder="Main headline"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Subtitle</label>
                <input
                  value={content.homepage.heroSubtitle}
                  onChange={e => updateHomepage("heroSubtitle", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300"
                  placeholder="Supporting text"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">CTA Button Text</label>
                <input
                  value={content.homepage.heroCta}
                  onChange={e => updateHomepage("heroCta", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300"
                  placeholder="Button text"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-[#062c24] uppercase">Announcement Banner</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={content.homepage.bannerEnabled}
                  onChange={e => updateHomepage("bannerEnabled", e.target.checked)}
                  className="w-5 h-5 accent-emerald-500"
                />
                <span className="text-xs font-bold text-slate-500">Enabled</span>
              </label>
            </div>
            {content.homepage.bannerEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Banner Text</label>
                  <input
                    value={content.homepage.bannerText}
                    onChange={e => updateHomepage("bannerText", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300"
                    placeholder="🎉 Special announcement here!"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Banner Link (optional)</label>
                  <input
                    value={content.homepage.bannerLink}
                    onChange={e => updateHomepage("bannerLink", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300"
                    placeholder="/promo or https://..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Editor */}
      {activeSection === "footer" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Basic Info</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Company Name</label>
                <input
                  value={content.footer.companyName}
                  onChange={e => updateFooter("companyName", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Copyright Text</label>
                <input
                  value={content.footer.copyright}
                  onChange={e => updateFooter("copyright", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-black text-[#062c24] uppercase">Footer Links</h3>
              <button onClick={addFooterLink} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100">
                + Add Link
              </button>
            </div>
            <div className="space-y-3">
              {content.footer.links.map((link, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <input
                    value={link.label}
                    onChange={e => updateFooterLink(i, "label", e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 p-2 rounded-lg text-sm outline-none"
                    placeholder="Label"
                  />
                  <input
                    value={link.url}
                    onChange={e => updateFooterLink(i, "url", e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 p-2 rounded-lg text-sm outline-none"
                    placeholder="/page or https://..."
                  />
                  <button onClick={() => removeFooterLink(i)} className="text-slate-300 hover:text-red-500 p-2">
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={saveContent}
          disabled={saving}
          className={`px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg transition-all ${
            saved ? "bg-emerald-500 text-white" : "bg-[#062c24] text-white hover:bg-emerald-800"
          } disabled:opacity-50`}
        >
          {saving ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</> : saved ? "✓ Saved!" : "Save All Changes"}
        </button>
      </div>
    </div>
  );
}