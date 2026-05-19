"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  vendorId?: string;
};

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-colors ${
        active
          ? "bg-[#062c24] text-white"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder, vendorId }: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-emerald-600 underline cursor-pointer" },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-xl max-w-full my-4" },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Write your article here...",
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[280px] px-4 py-3 focus:outline-none",
      },
    },
  });

  // Sync external value changes (e.g. when editing an existing article)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  async function handleImageUpload(file: File) {
    if (!editor) return;
    try {
      const storage = getStorage();
      const path = `articles/${vendorId || "admin"}/content/${Date.now()}_${file.name}`;
      const snap = await uploadBytes(ref(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (e) {
      console.error("Image upload failed", e);
      alert("Image upload failed. Please try again.");
    }
  }

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href || "";
    const url = window.prompt("Enter URL:", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
  }

  if (!editor) return null;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-400 transition-colors">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-slate-50">
        {/* Text style */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <b>B</b>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <i>I</i>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <u>U</u>
        </ToolbarButton>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading">
          <span className="font-black text-[10px]">H2</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Subheading">
          <span className="font-black text-[10px]">H3</span>
        </ToolbarButton>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          <i className="fas fa-list-ul" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
          <i className="fas fa-list-ol" />
        </ToolbarButton>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Alignment */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align left">
          <i className="fas fa-align-left" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align center">
          <i className="fas fa-align-center" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align right">
          <i className="fas fa-align-right" />
        </ToolbarButton>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Link */}
        <ToolbarButton onClick={setLink} active={editor.isActive("link")} title="Insert link">
          <i className="fas fa-link" />
        </ToolbarButton>

        {/* Image upload */}
        <ToolbarButton onClick={() => imageInputRef.current?.click()} title="Insert image">
          <i className="fas fa-image" />
        </ToolbarButton>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
        />

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Block quote */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote">
          <i className="fas fa-quote-left text-[10px]" />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <div className="bg-white">
        <EditorContent editor={editor} />
      </div>

      {/* Editor styles */}
      <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #94a3b8;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror h2 { font-size: 1.25rem; font-weight: 800; color: #062c24; margin: 1.25rem 0 0.5rem; line-height: 1.3; }
        .ProseMirror h3 { font-size: 1rem; font-weight: 700; color: #062c24; margin: 1rem 0 0.4rem; line-height: 1.4; }
        .ProseMirror p { margin: 0.6rem 0; line-height: 1.75; color: #374151; }
        .ProseMirror ul { padding-left: 1.4rem; margin: 0.6rem 0; list-style-type: disc; }
        .ProseMirror ol { padding-left: 1.4rem; margin: 0.6rem 0; list-style-type: decimal; }
        .ProseMirror li { margin: 0.25rem 0; line-height: 1.7; color: #374151; }
        .ProseMirror strong { font-weight: 700; color: #111827; }
        .ProseMirror em { font-style: italic; }
        .ProseMirror u { text-decoration: underline; }
        .ProseMirror blockquote { border-left: 3px solid #10b981; padding: 0.5rem 1rem; margin: 0.75rem 0; background: #f0fdf4; border-radius: 0 0.5rem 0.5rem 0; color: #065f46; font-style: italic; }
        .ProseMirror a { color: #059669; text-decoration: underline; }
        .ProseMirror img { border-radius: 0.75rem; max-width: 100%; margin: 1rem 0; }
        .ProseMirror:focus { outline: none; }
        .ProseMirror .text-left { text-align: left; }
        .ProseMirror .text-center { text-align: center; }
        .ProseMirror .text-right { text-align: right; }
      `}</style>
    </div>
  );
}
