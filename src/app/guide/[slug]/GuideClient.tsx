"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import BottomNav from "@/components/BottomNav";

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  videoUrl?: string;
  category: string;
  authorName: string;
  authorType: "admin" | "vendor";
  vendorSlug?: string;
  createdAt: any;
  status: string;
};

function youtubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function formatDate(ts: any): string {
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" });
}

export default function GuideClient({ slug }: { slug: string }) {
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const q = query(
          collection(db, "articles"),
          where("slug", "==", slug),
          where("status", "==", "published"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (snap.empty) { setNotFound(true); setLoading(false); return; }
        setArticle({ id: snap.docs[0].id, ...snap.docs[0].data() } as Article);
      } catch (e) {
        console.error(e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  function share() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: article?.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <i className="fas fa-spinner fa-spin text-3xl text-slate-300"></i>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
      <i className="fas fa-book-open text-4xl text-slate-200"></i>
      <p className="font-bold text-slate-400">Article not found</p>
      <Link href="/guide" className="text-emerald-600 text-sm font-bold hover:underline">
        ← Back to Camping Guide
      </Link>
    </div>
  );

  const vidId = article!.videoUrl ? youtubeId(article!.videoUrl) : null;

  return (
    <div className="pb-24 min-h-screen bg-slate-50" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Back nav */}
      <div className="bg-[#062c24] px-6 pt-10 pb-6">
        <Link href="/guide" className="inline-flex items-center gap-2 text-emerald-400 text-xs font-bold hover:text-white transition-colors mb-4">
          <i className="fas fa-arrow-left"></i> Camping Guide
        </Link>
        <span className="block text-[9px] font-black uppercase text-emerald-500 tracking-widest mb-2">{article!.category}</span>
        <h1 className="text-2xl font-black text-white uppercase leading-tight">{article!.title}</h1>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-[9px] text-emerald-200/70">By {article!.authorName}</span>
          <span className="text-emerald-800">·</span>
          <span className="text-[9px] text-emerald-200/70">{formatDate(article!.createdAt)}</span>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">

        {/* Cover image */}
        {article!.coverImage && !vidId && (
          <div className="rounded-2xl overflow-hidden">
            <img src={article!.coverImage} alt={article!.title} className="w-full h-56 object-cover" />
          </div>
        )}

        {/* YouTube embed */}
        {vidId && (
          <div className="rounded-2xl overflow-hidden aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${vidId}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Excerpt */}
        <p className="text-sm text-slate-500 font-medium leading-relaxed italic bg-white rounded-2xl p-5 border border-slate-100">
          {article!.excerpt}
        </p>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="prose prose-sm max-w-none text-slate-600 leading-relaxed whitespace-pre-wrap">
            {article!.content}
          </div>
        </div>

        {/* Vendor link */}
        {article!.authorType === "vendor" && article!.vendorSlug && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Written by a vendor</p>
              <p className="text-sm font-bold text-[#062c24]">{article!.authorName}</p>
            </div>
            <Link href={`/shop/${article!.vendorSlug}`}
              className="bg-[#062c24] text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-800 transition-colors">
              Visit Shop
            </Link>
          </div>
        )}

        {/* Share */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500">Found this helpful? Share it!</p>
          <button onClick={share}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-colors ${
              copied ? "bg-emerald-500 text-white" : "bg-[#062c24] text-white hover:bg-emerald-800"
            }`}>
            <i className={`fas ${copied ? "fa-check" : "fa-share-alt"}`}></i>
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
