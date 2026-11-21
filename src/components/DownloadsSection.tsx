"use client";

// "Free downloads" on the directory page: files the admin shares in Admin › Site › Downloads.

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, increment, query, updateDoc, where } from "firebase/firestore";
import { fileLabel, formatBytes, isHttps, sortDownloads, type DownloadItem } from "@/lib/downloads";

const INITIAL = 6;

export default function DownloadsSection() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    getDocs(query(collection(db, "downloads"), where("published", "==", true)))
      .then(snap => setItems(sortDownloads(snap.docs.map(d => ({ id: d.id, ...d.data() } as DownloadItem)).filter(d => isHttps(d.fileUrl)))))
      .catch(() => { });
  }, []);

  if (items.length === 0) return null;
  const shown = showAll ? items : items.slice(0, INITIAL);

  function count(id: string) {
    updateDoc(doc(db, "downloads", id), { downloadCount: increment(1) }).catch(() => { });
  }

  return (
    <section className="pb-8" aria-labelledby="downloads-title">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-slate-200"></div>
        <h3 id="downloads-title" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Free Downloads</h3>
        <div className="h-px flex-1 bg-slate-200"></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {shown.map(d => (
          <a key={d.id} href={d.fileUrl} target="_blank" rel="noreferrer" onClick={() => count(d.id)}
            aria-label={`Download ${d.title} (${fileLabel(d.fileName)}, ${formatBytes(d.fileSize)})`}
            className="group bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-lg transition-all flex flex-col">
            <div className="aspect-[4/3] overflow-hidden relative bg-gradient-to-br from-[#062c24] to-emerald-700 flex items-center justify-center">
              {isHttps(d.coverUrl)
                ? <img src={d.coverUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                : <i className="fas fa-file-lines text-3xl text-white/70" aria-hidden="true"></i>}
              <span className="absolute top-2 left-2 bg-white/95 text-[#062c24] text-[8px] font-black px-2 py-0.5 rounded-full">
                {fileLabel(d.fileName)}
              </span>
            </div>
            <div className="p-3 flex-1 flex flex-col">
              <h4 className="text-[11px] font-black text-[#062c24] leading-tight line-clamp-2">{d.title}</h4>
              {d.description && <p className="text-[10px] text-slate-500 mt-1 leading-snug line-clamp-3 whitespace-pre-line">{d.description}</p>}
              <div className="mt-auto pt-2.5 flex items-center justify-between gap-2">
                <span className="text-[9px] font-bold text-slate-400">{formatBytes(d.fileSize)}</span>
                <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wide">
                  <i className="fas fa-download mr-1" aria-hidden="true"></i>Download
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
      {items.length > INITIAL && (
        <button type="button" onClick={() => setShowAll(v => !v)}
          className="mt-3 w-full min-h-11 rounded-xl border border-slate-200 bg-white text-[11px] font-black text-[#062c24] uppercase tracking-widest hover:bg-slate-50">
          {showAll ? "Show less" : `See all ${items.length}`}
        </button>
      )}
    </section>
  );
}
