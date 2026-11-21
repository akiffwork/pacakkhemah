"use client";

// Admin › Site › Downloads: files anyone can download from the directory page.

import { useEffect, useRef, useState } from "react";
import { db, storage } from "@/lib/firebase";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytesResumable } from "firebase/storage";
import {
  BottomSheet, Chip, ConfirmSheet, EmptyState, Field, Switch,
  inputCls, primaryBtn, primarySmallBtn, smallBtn,
} from "@/components/ui/kit";
import {
  COVER_MAX_MB, DESCRIPTION_MAX, FILE_ACCEPT, FILE_MAX_MB, TITLE_MAX,
  contentDisposition, contentTypeFor, coverError, fileError, fileLabel, formatBytes,
  safeFileName, sortDownloads, type DownloadItem,
} from "@/lib/downloads";

type Notify = (msg: string, tone?: "success" | "error") => void;

type Form = { title: string; description: string; published: boolean };

async function upload(path: string, file: File, meta: { contentType: string; contentDisposition?: string }, onProgress?: (p: number) => void) {
  const task = uploadBytesResumable(storageRef(storage, path), file, meta);
  await new Promise<void>((resolve, reject) => {
    task.on("state_changed", s => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), reject, () => resolve());
  });
  return { url: await getDownloadURL(task.snapshot.ref), path };
}

async function removeObject(path?: string) {
  if (!path) return;
  try { await deleteObject(storageRef(storage, path)); } catch { /* already gone */ }
}

export default function DownloadsTab({ notify }: { notify: Notify }) {
  const [items, setItems] = useState<DownloadItem[] | null>(null);
  const [editing, setEditing] = useState<DownloadItem | "new" | null>(null);
  const [toDelete, setToDelete] = useState<DownloadItem | null>(null);

  useEffect(() => onSnapshot(collection(db, "downloads"),
    snap => setItems(sortDownloads(snap.docs.map(d => ({ id: d.id, ...d.data() } as DownloadItem)))),
    err => { console.error(err); setItems([]); }), []);

  async function togglePublished(d: DownloadItem, published: boolean) {
    try {
      await updateDoc(doc(db, "downloads", d.id), { published, updatedAt: serverTimestamp() });
      notify(published ? "Shown on the site" : "Hidden from the site");
    } catch (e) {
      console.error(e);
      notify("Could not update it", "error");
    }
  }

  async function doDelete(d: DownloadItem) {
    try {
      await deleteDoc(doc(db, "downloads", d.id));
      await Promise.all([removeObject(d.filePath), removeObject(d.coverPath)]);
      notify("Download deleted");
    } catch (e) {
      console.error(e);
      notify("Could not delete it", "error");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[#062c24]">
          {items ? `${items.length} ${items.length === 1 ? "file" : "files"}` : "Loading"}
        </p>
        <button type="button" onClick={() => setEditing("new")} className={primarySmallBtn}>
          <i className="fas fa-plus mr-1.5" aria-hidden="true"></i>Add download
        </button>
      </div>

      {items && items.length === 0 && (
        <EmptyState icon="fa-file-arrow-down" title="No downloads yet"
          body="Add a PDF or other file with a title, description and cover. It shows on the homepage for anyone to download." />
      )}

      {items?.map(d => (
        <div key={d.id} className="bg-white rounded-2xl border border-slate-200 p-3 flex gap-3">
          <div className="w-16 h-20 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center text-slate-500">
            {d.coverUrl
              ? <img src={d.coverUrl} alt="" className="w-full h-full object-cover" />
              : <i className="fas fa-file-lines text-xl" aria-hidden="true"></i>}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <p className="text-sm font-bold text-[#062c24] line-clamp-2">{d.title}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip tone={d.published ? "good" : "neutral"}>{d.published ? "Shown" : "Hidden"}</Chip>
              <span className="text-xs text-slate-600">{fileLabel(d.fileName)} · {formatBytes(d.fileSize)}</span>
              <span className="text-xs text-slate-600">· {d.downloadCount || 0} downloads</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button type="button" onClick={() => setEditing(d)} className={smallBtn}>Edit</button>
              <a href={d.fileUrl} target="_blank" rel="noreferrer" className={`${smallBtn} inline-flex items-center`}>Open</a>
              <button type="button" onClick={() => setToDelete(d)} aria-label={`Delete ${d.title}`}
                className="min-h-10 w-10 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center">
                <i className="fas fa-trash text-xs" aria-hidden="true"></i>
              </button>
              <div className="ml-auto">
                <Switch checked={d.published} onChange={v => togglePublished(d, v)} label={`Show ${d.title} on the site`} />
              </div>
            </div>
          </div>
        </div>
      ))}

      {editing && (
        <DownloadEditor item={editing === "new" ? null : editing} notify={notify} onClose={() => setEditing(null)} />
      )}

      {toDelete && (
        <ConfirmSheet title="Delete this download?" confirmLabel="Delete" tone="danger" onClose={() => setToDelete(null)}
          body={<p>&ldquo;{toDelete.title}&rdquo; and its file are removed from the site straight away. This cannot be undone.</p>}
          onConfirm={() => { const d = toDelete; setToDelete(null); doDelete(d); }} />
      )}
    </div>
  );
}

function DownloadEditor({ item, notify, onClose }: { item: DownloadItem | null; notify: Notify; onClose: () => void }) {
  const [form, setForm] = useState<Form>({
    title: item?.title || "",
    description: item?.description || "",
    published: item ? item.published : true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [removeCover, setRemoveCover] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview); }, [coverPreview]);

  function pickFile(f?: File) {
    if (!f) return;
    const err = fileError(f);
    if (err) { setError(err); return; }
    setError("");
    setFile(f);
    if (!form.title.trim()) setForm(s => ({ ...s, title: f.name.replace(/\.[^.]+$/, "").slice(0, TITLE_MAX) }));
  }

  function pickCover(f?: File) {
    if (!f) return;
    const err = coverError(f);
    if (err) { setError(err); return; }
    setError("");
    setCover(f);
    setRemoveCover(false);
    setCoverPreview(URL.createObjectURL(f));
  }

  async function save() {
    const title = form.title.trim();
    if (!title) { setError("Add a title"); return; }
    if (!item && !file) { setError("Choose the file to share"); return; }
    setError("");
    setSaving(true);
    const stamp = Date.now();
    const uploaded: string[] = [];
    try {
      const payload: Record<string, unknown> = {
        title: title.slice(0, TITLE_MAX),
        description: form.description.trim().slice(0, DESCRIPTION_MAX),
        published: form.published,
        updatedAt: serverTimestamp(),
      };
      if (file) {
        setProgress(0);
        const up = await upload(`downloads/files/${stamp}_${safeFileName(file.name)}`, file,
          { contentType: contentTypeFor(file.name)!, contentDisposition: contentDisposition(file.name) }, setProgress);
        uploaded.push(up.path);
        Object.assign(payload, { fileUrl: up.url, filePath: up.path, fileName: file.name, fileSize: file.size, fileType: contentTypeFor(file.name) });
      }
      if (cover) {
        const up = await upload(`downloads/covers/${stamp}_${safeFileName(cover.name)}`, cover,
          { contentType: cover.type || contentTypeFor(cover.name) || "image/jpeg" });
        uploaded.push(up.path);
        Object.assign(payload, { coverUrl: up.url, coverPath: up.path });
      } else if (removeCover) {
        Object.assign(payload, { coverUrl: "", coverPath: "" });
      }

      if (item) {
        await updateDoc(doc(db, "downloads", item.id), payload);
        // The old files are replaced only once the new ones are saved
        if (file) await removeObject(item.filePath);
        if (cover || removeCover) await removeObject(item.coverPath);
      } else {
        await addDoc(collection(db, "downloads"), { ...payload, downloadCount: 0, createdAt: serverTimestamp() });
      }
      notify(item ? "Download updated" : "Download added");
      onClose();
    } catch (e) {
      console.error(e);
      await Promise.all(uploaded.map(p => removeObject(p)));
      setError("Could not save it. Check your connection and try again.");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  const shownCover = coverPreview || (!removeCover && item?.coverUrl) || "";

  return (
    <BottomSheet title={item ? "Edit download" : "Add download"} onClose={() => { if (!saving) onClose(); }}>
      <Field id="dl-file" label="File" hint={`PDF, ZIP, Word, Excel, PowerPoint, EPUB or image, up to ${FILE_MAX_MB} MB`}>
        <input ref={fileRef} id="dl-file" type="file" accept={FILE_ACCEPT} className="sr-only"
          onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={saving}
          className="min-h-13 w-full rounded-xl border border-dashed border-slate-400 bg-slate-50 px-3 flex items-center gap-3 text-left hover:bg-slate-100">
          <i className="fas fa-file-arrow-up text-lg text-[#062c24]" aria-hidden="true"></i>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-slate-800 truncate">
              {file ? file.name : item ? item.fileName : "Choose a file"}
            </span>
            {(file || item) && (
              <span className="block text-xs text-slate-600">
                {fileLabel(file ? file.name : item!.fileName)} · {formatBytes(file ? file.size : item!.fileSize)}
                {item && !file ? " · tap to replace" : ""}
              </span>
            )}
          </span>
        </button>
      </Field>

      <Field id="dl-title" label="Title">
        <input id="dl-title" className={inputCls} value={form.title} maxLength={TITLE_MAX}
          onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Camping checklist for beginners" />
      </Field>

      <Field id="dl-desc" label="Description" hint={`${form.description.length}/${DESCRIPTION_MAX}`}>
        <textarea id="dl-desc" rows={4} className={`${inputCls} py-2.5 resize-none`} value={form.description} maxLength={DESCRIPTION_MAX}
          onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What it is and who it helps" />
      </Field>

      <Field id="dl-cover" label="Cover image" hint={`Optional. Portrait works best, up to ${COVER_MAX_MB} MB`}>
        <input ref={coverRef} id="dl-cover" type="file" accept="image/*" className="sr-only"
          onChange={e => { pickCover(e.target.files?.[0]); e.target.value = ""; }} />
        <div className="flex items-center gap-3">
          <div className="w-20 h-24 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center text-slate-500 shrink-0">
            {shownCover ? <img src={shownCover} alt="Cover preview" className="w-full h-full object-cover" /> : <i className="fas fa-image text-xl" aria-hidden="true"></i>}
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => coverRef.current?.click()} disabled={saving} className={smallBtn}>
              {shownCover ? "Change cover" : "Add cover"}
            </button>
            {shownCover && (
              <button type="button" disabled={saving} className={`${smallBtn} text-red-600`}
                onClick={() => { setCover(null); setCoverPreview(""); setRemoveCover(true); }}>
                Remove cover
              </button>
            )}
          </div>
        </div>
      </Field>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Show on the site</p>
          <p className="text-xs text-slate-600">Turn off to keep it as a draft</p>
        </div>
        <Switch checked={form.published} onChange={v => setForm({ ...form, published: v })} label="Show on the site" />
      </div>

      {error && <p role="alert" className="text-[13px] font-semibold text-red-700">{error}</p>}

      <button type="button" onClick={save} disabled={saving} className={primaryBtn}>
        {saving ? (progress !== null && progress < 1 ? `Uploading ${Math.round(progress * 100)}%` : "Saving") : item ? "Save changes" : "Add download"}
      </button>
    </BottomSheet>
  );
}
