"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

type Post = {
  id: string;
  content: string;
  image?: string;
  pinned?: boolean;
  createdAt: any;
};

type UpdatesTabProps = {
  vendorId: string;
};

export default function UpdatesTab({ vendorId }: UpdatesTabProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  
  // Form state
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Load posts
  useEffect(() => {
    const q = query(
      collection(db, "vendors", vendorId, "posts"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const allPosts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
      // Sort: pinned first, then by date
      allPosts.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
      setPosts(allPosts);
      setLoading(false);
    });

    return () => unsub();
  }, [vendorId]);

  // Reset form
  function resetForm() {
    setContent("");
    setImageFile(null);
    setImagePreview(null);
    setPinned(false);
    setEditingPost(null);
  }

  // Open modal for new post
  function openNewPost() {
    resetForm();
    setShowModal(true);
  }

  // Open modal for editing
  function openEditPost(post: Post) {
    setEditingPost(post);
    setContent(post.content);
    setImagePreview(post.image || null);
    setPinned(post.pinned || false);
    setShowModal(true);
  }

  // Handle image selection
  function handleImageSelect(file: File) {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  // Save post
  async function savePost() {
    if (!content.trim()) return;
    setSaving(true);

    try {
      let imageUrl = editingPost?.image || "";

      // Upload new image if selected
      if (imageFile) {
        const storage = getStorage();
        const fileName = `posts/${vendorId}/${Date.now()}_${imageFile.name}`;
        const snap = await uploadBytes(ref(storage, fileName), imageFile);
        imageUrl = await getDownloadURL(snap.ref);
      }

      if (editingPost) {
        // Update existing post
        await updateDoc(doc(db, "vendors", vendorId, "posts", editingPost.id), {
          content: content.trim(),
          image: imageUrl || null,
          pinned,
        });
      } else {
        // Create new post
        await addDoc(collection(db, "vendors", vendorId, "posts"), {
          content: content.trim(),
          image: imageUrl || null,
          pinned,
          createdAt: serverTimestamp(),
        });
      }

      setShowModal(false);
      resetForm();
    } catch (e) {
      console.error(e);
      alert("Failed to save post");
    } finally {
      setSaving(false);
    }
  }

  // Delete post
  async function deletePost(postId: string) {
    if (!confirm("Delete this post?")) return;
    setDeleting(postId);
    try {
      await deleteDoc(doc(db, "vendors", vendorId, "posts", postId));
    } catch (e) {
      console.error(e);
      alert("Failed to delete");
    } finally {
      setDeleting(null);
    }
  }

  // Toggle pin
  async function togglePin(post: Post) {
    try {
      await updateDoc(doc(db, "vendors", vendorId, "posts", post.id), {
        pinned: !post.pinned,
      });
    } catch (e) {
      console.error(e);
    }
  }

  // Format time ago
  function formatTimeAgo(timestamp: any): string {
    if (!timestamp?.toDate) return "Just now";
    const seconds = Math.floor((Date.now() - timestamp.toDate().getTime()) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return timestamp.toDate().toLocaleDateString();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-[#062c24] uppercase">Updates & Announcements</h2>
            <p className="text-xs text-slate-400 mt-1">Post updates that appear on your shop page</p>
          </div>
          <button
            onClick={openNewPost}
            className="flex items-center gap-2 bg-[#062c24] text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-800 transition-colors"
          >
            <i className="fas fa-plus"></i>
            New Post
          </button>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <i className="fas fa-info-circle text-blue-500 text-sm"></i>
            </div>
            <div className="text-xs text-blue-700">
              <p className="font-bold mb-1">How Updates Work</p>
              <ul className="space-y-1 text-blue-600">
                <li>• Posts appear in the "Updates" tab on your shop page</li>
                <li>• Pinned posts always show first</li>
                <li>• Great for announcements, promos, or tips for customers</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Posts List */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">
          Your Posts ({posts.length})
        </h3>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-slate-50 rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-100 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-bullhorn text-slate-300 text-2xl"></i>
            </div>
            <p className="text-sm font-bold text-slate-400">No posts yet</p>
            <p className="text-xs text-slate-300 mt-1 mb-4">Create your first update to engage customers</p>
            <button
              onClick={openNewPost}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
            >
              <i className="fas fa-plus mr-1"></i> Create Post
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <div
                key={post.id}
                className={`rounded-xl border p-4 transition-all ${
                  post.pinned
                    ? "bg-amber-50 border-amber-200"
                    : "bg-slate-50 border-slate-100"
                }`}
              >
                {/* Pin badge */}
                {post.pinned && (
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-600 uppercase mb-2">
                    <i className="fas fa-thumbtack"></i> Pinned
                  </div>
                )}

                {/* Content */}
                <p className="text-sm text-slate-700 leading-relaxed mb-3">{post.content}</p>

                {/* Image */}
                {post.image && (
                  <div className="mb-3 rounded-lg overflow-hidden max-w-xs">
                    <img src={post.image} alt="Post" className="w-full h-auto" />
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold text-slate-400">
                    {formatTimeAgo(post.createdAt)}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => togglePin(post)}
                      className={`p-2 rounded-lg text-xs transition-colors ${
                        post.pinned
                          ? "text-amber-500 hover:bg-amber-100"
                          : "text-slate-400 hover:bg-slate-100"
                      }`}
                      title={post.pinned ? "Unpin" : "Pin"}
                    >
                      <i className="fas fa-thumbtack"></i>
                    </button>
                    <button
                      onClick={() => openEditPost(post)}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 text-xs transition-colors"
                      title="Edit"
                    >
                      <i className="fas fa-pen"></i>
                    </button>
                    <button
                      onClick={() => deletePost(post.id)}
                      disabled={deleting === post.id}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 text-xs transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <i className={`fas ${deleting === post.id ? "fa-spinner fa-spin" : "fa-trash"}`}></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-base font-black text-[#062c24] uppercase">
                {editingPost ? "Edit Post" : "New Post"}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Content */}
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase mb-1.5 block">
                  What's New? <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Share an update, announcement, or tip with your customers..."
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 resize-none"
                />
              </div>

              {/* Image */}
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase mb-1.5 block">
                  Image (Optional)
                </label>
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="Preview" className="max-w-[200px] rounded-lg" />
                    <button
                      onClick={() => { setImageFile(null); setImagePreview(null); }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
                    <i className="fas fa-image text-slate-300"></i>
                    <span className="text-xs font-bold text-slate-400">Click to upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                    />
                  </label>
                )}
              </div>

              {/* Pin toggle */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-slate-700">Pin this post</p>
                  <p className="text-[10px] text-slate-400">Pinned posts appear first on your shop</p>
                </div>
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100">
              <button
                onClick={savePost}
                disabled={!content.trim() || saving}
                className="w-full bg-[#062c24] text-white py-3.5 rounded-xl text-xs font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-800 transition-colors"
              >
                {saving ? (
                  <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</>
                ) : editingPost ? (
                  "Update Post"
                ) : (
                  "Publish Post"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}