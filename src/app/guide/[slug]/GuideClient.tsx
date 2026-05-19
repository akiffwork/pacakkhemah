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
          <div
            className="article-content"
            dangerouslySetInnerHTML={{ __html: article!.content }}
          />
          <style jsx global>{`
            .article-content h2 { font-size: 1.2rem; font-weight: 800; color: #062c24; margin: 1.5rem 0 0.5rem; line-height: 1.3; }
            .article-content h3 { font-size: 1rem; font-weight: 700; color: #1a1a1a; margin: 1.25rem 0 0.4rem; line-height: 1.4; }
            .article-content p { margin: 0.75rem 0; line-height: 1.8; color: #374151; font-size: 0.9rem; }
            .article-content ul { padding-left: 1.4rem; margin: 0.75rem 0; list-style-type: disc; }
            .article-content ol { padding-left: 1.4rem; margin: 0.75rem 0; list-style-type: decimal; }
            .article-content li { margin: 0.35rem 0; line-height: 1.7; color: #374151; font-size: 0.9rem; }
            .article-content strong { font-weight: 700; color: #111827; }
            .article-content em { font-style: italic; }
            .article-content u { text-decoration: underline; }
            .article-content a { color: #059669; text-decoration: underline; }
            .article-content blockquote { border-left: 3px solid #10b981; padding: 0.6rem 1rem; margin: 1rem 0; background: #f0fdf4; border-radius: 0 0.5rem 0.5rem 0; color: #065f46; font-style: italic; }
            .article-content img { border-radius: 0.75rem; max-width: 100%; margin: 1.25rem auto; display: block; }
            .article-content .text-left { text-align: left; }
            .article-content .text-center { text-align: center; }
            .article-content .text-right { text-align: right; }
          `}</style>
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
