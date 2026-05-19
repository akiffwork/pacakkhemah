"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import BottomNav from "@/components/BottomNav";

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage?: string;
  videoUrl?: string;
  category: string;
  authorName: string;
  authorType: "admin" | "vendor";
  createdAt: any;
};

const CATEGORIES = ["All", "Tent Setup", "Camping Tips", "Gear Guide", "General"];

function timeAgo(ts: any): string {
  if (!ts?.toDate) return "";
  const s = Math.floor((Date.now() - ts.toDate().getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return ts.toDate().toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

function youtubeThumb(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

function ArticleCard({ article }: { article: Article }) {
  const thumb = article.coverImage || (article.videoUrl ? youtubeThumb(article.videoUrl) : null);
  return (
    <Link href={`/guide/${article.slug}`}
      className="group bg-white rounded-[1.5rem] border border-slate-100 hover:border-emerald-300 hover:shadow-xl transition-all overflow-hidden flex flex-col">
      <div className="relative h-44 bg-slate-100 overflow-hidden">
        {thumb ? (
          <img src={thumb} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <i className="fas fa-book-open text-4xl text-slate-200"></i>
          </div>
        )}
        {article.videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center">
              <i className="fas fa-play text-white text-lg ml-1"></i>
            </div>
          </div>
        )}
        <span className="absolute top-3 left-3 bg-[#062c24] text-white text-[8px] font-black uppercase px-2 py-1 rounded-lg">
          {article.category}
        </span>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-black text-[#062c24] text-sm uppercase leading-tight mb-2 group-hover:text-emerald-700 transition-colors line-clamp-2">
          {article.title}
        </h3>
        <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-3 flex-1">{article.excerpt}</p>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          <span className="text-[9px] font-bold text-slate-400">{article.authorName}</span>
          <span className="text-[9px] text-slate-300">{timeAgo(article.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}

export default function GuidePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filtered, setFiltered] = useState<Article[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const q = query(
          collection(db, "articles"),
          where("status", "==", "published"),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Article));
        setArticles(data);
        setFiltered(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function filterCategory(cat: string) {
    setActiveCategory(cat);
    setFiltered(cat === "All" ? articles : articles.filter(a => a.category === cat));
  }

  return (
    <div className="pb-24 min-h-screen bg-slate-50" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <header className="bg-[#062c24] text-white pt-10 pb-14 rounded-b-[2.5rem] shadow-xl">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-book-open text-emerald-400 text-2xl"></i>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Camping Guide</h1>
          <p className="text-sm text-emerald-100/80 font-medium">Tips, tricks & tent setup guides from the community</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 -mt-6 relative z-10">

        {/* Category filter */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-6">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => filterCategory(cat)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase shrink-0 transition-all border ${
                  activeCategory === cat
                    ? "bg-[#062c24] text-white border-[#062c24]"
                    : "bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-700"
                }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Articles grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-[1.5rem] border border-slate-100 h-64 animate-pulse"></div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
            <i className="fas fa-book-open text-4xl text-slate-200 mb-4 block"></i>
            <p className="text-sm font-bold text-slate-400">No articles yet</p>
            <p className="text-xs text-slate-300 mt-1">Check back soon for camping tips and guides</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(a => <ArticleCard key={a.id} article={a} />)}
          </div>
        )}
      </main>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <BottomNav />
    </div>
  );
}
