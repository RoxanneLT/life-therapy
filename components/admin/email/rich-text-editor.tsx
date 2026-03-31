"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Bold,
  Italic,
  Underline,
  Link,
  List,
  ListOrdered,
  Type,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  Minus,
  Code,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Strip browser-injected font-family / font-size from inline styles, unwrap <font> tags,
// and unwrap variable chip spans so {{variable}} saves as plain text without styling.
function sanitizeHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  tmp.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    el.style.removeProperty("font-family");
    el.style.removeProperty("font-size");
    if (!el.getAttribute("style")) el.removeAttribute("style");
  });
  tmp.querySelectorAll<HTMLElement>("font").forEach((font) => {
    while (font.firstChild) font.parentNode!.insertBefore(font.firstChild, font);
    font.remove();
  });
  // Unwrap variable chip spans — keeps {{variable}} text but removes the styled wrapper
  tmp.querySelectorAll<HTMLElement>("span").forEach((span) => {
    if (/^\{\{[^}]+\}\}$/.test(span.textContent?.trim() ?? "")) {
      while (span.firstChild) span.parentNode!.insertBefore(span.firstChild, span);
      span.remove();
    }
  });
  return tmp.innerHTML;
}

// Deep-clean pasted HTML from Word/Docs/web — keeps semantic tags, strips everything else.
function sanitizePastedHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;

  // Remove all <style>, <meta>, <link>, <title>, <script> tags (Word/Docs inject these)
  tmp.querySelectorAll("style, meta, link, title, script, xml, o\\:p").forEach((el) => el.remove());

  // Remove ALL inline styles and classes — we want clean semantic HTML only
  tmp.querySelectorAll<HTMLElement>("*").forEach((el) => {
    el.removeAttribute("style");
    el.removeAttribute("class");
    el.removeAttribute("id");
    el.removeAttribute("dir");
    el.removeAttribute("lang");
  });

  // Unwrap <font> and <span> tags (keep children)
  tmp.querySelectorAll<HTMLElement>("font, span").forEach((el) => {
    while (el.firstChild) el.parentNode!.insertBefore(el.firstChild, el);
    el.remove();
  });

  // Remove empty <p> elements
  tmp.querySelectorAll("p").forEach((p) => {
    if (!p.textContent?.trim() && !p.querySelector("img, br")) {
      p.remove();
    }
  });

  // Normalize <b> to <strong>, <i> to <em> for consistency
  tmp.querySelectorAll("b").forEach((b) => {
    const strong = document.createElement("strong");
    strong.innerHTML = b.innerHTML;
    b.replaceWith(strong);
  });
  tmp.querySelectorAll("i").forEach((i) => {
    const em = document.createElement("em");
    em.innerHTML = i.innerHTML;
    i.replaceWith(em);
  });

  return sanitizeHtml(tmp.innerHTML);
}

const DEFAULT_VARIABLE_CHIPS = [
  { key: "firstName", label: "First Name", description: "Client\u2019s first name (falls back to \u2018there\u2019)" },
  { key: "unsubscribeUrl", label: "Unsubscribe URL", description: "One-click unsubscribe link" },
  { key: "passwordResetUrl", label: "Set Password Link", description: "Generates a unique login/password setup link per client. Use in CTA URL or body." },
];

export interface VariableChip {
  key: string;
  label: string;
  description: string;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  variables?: VariableChip[];
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing your email content...",
  minHeight = "240px",
  variables = DEFAULT_VARIABLE_CHIPS,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const hasMounted = useRef(false);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  // Set initial content on mount — sanitize immediately to clean any legacy injected styles
  useEffect(() => {
    if (editorRef.current && !hasMounted.current) {
      const clean = sanitizeHtml(value);
      editorRef.current.innerHTML = clean;
      hasMounted.current = true;
      if (clean !== value) onChange(clean);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes only (not our own edits)
  useEffect(() => {
    if (!hasMounted.current) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  // Track active formats on every selection change for toolbar active states
  useEffect(() => {
    function update() {
      if (!editorRef.current?.contains(globalThis.getSelection()?.anchorNode ?? null)) return;
      const active = new Set<string>();
      try {
        if (document.queryCommandState("bold")) active.add("bold");
        if (document.queryCommandState("italic")) active.add("italic");
        if (document.queryCommandState("underline")) active.add("underline");
        if (document.queryCommandState("insertUnorderedList")) active.add("insertUnorderedList");
        if (document.queryCommandState("insertOrderedList")) active.add("insertOrderedList");
        if (document.queryCommandState("justifyCenter")) active.add("justifyCenter");
        const block = document.queryCommandValue("formatBlock").toLowerCase().replace(/^<|>$/g, "");
        if (block) active.add(block);
      } catch {
        // queryCommandState can throw in some browsers — ignore
      }
      setActiveFormats(active);
    }
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(sanitizeHtml(editorRef.current.innerHTML));
    }
  }, [onChange]);

  function exec(command: string, val?: string) {
    // Use semantic tags (e.g. <b>) instead of <span style="font-weight:bold">
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(command, false, val);
    // Don't reset innerHTML here — that would lose cursor position.
    // sanitizeHtml runs in handleInput's onChange path (saved value only).
    editorRef.current?.focus();
    handleInput();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const clipHtml = e.clipboardData.getData("text/html");
    const plain = e.clipboardData.getData("text/plain");

    let htmlToInsert: string;

    if (clipHtml) {
      // Prefer HTML to preserve bold/italic/links, but clean it aggressively
      htmlToInsert = sanitizePastedHtml(clipHtml);
    } else if (plain) {
      // Plain text fallback — wrap in <p> tags
      htmlToInsert = plain
        .split(/\n\n+/)
        .map((para) => `<p>${para.replaceAll("\n", "<br>")}</p>`)
        .join("");
    } else {
      return;
    }

    const selection = globalThis.getSelection();
    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const frag = range.createContextualFragment(htmlToInsert);
      range.insertNode(frag);
      range.collapse(false);
    }
    handleInput();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    switch (e.key.toLowerCase()) {
      case "b": e.preventDefault(); exec("bold"); break;
      case "i": e.preventDefault(); exec("italic"); break;
      case "u": e.preventDefault(); exec("underline"); break;
      case "k": e.preventDefault(); insertLink(); break;
    }
  }

  function insertVariable(variable: string) {
    const html = `<span style="background: #f0f4f0; color: #5a7a58; padding: 1px 6px; border-radius: 4px; font-size: 13px; font-family: monospace;">{{${variable}}}</span>&nbsp;`;
    exec("insertHTML", html);
  }

  function insertLink() {
    // If cursor is already inside a link, pre-fill with existing href
    const sel = globalThis.getSelection();
    const anchor = sel?.anchorNode && (sel.anchorNode as Element).closest
      ? (sel.anchorNode as Element).closest?.("a") ?? (sel.anchorNode.parentElement?.closest("a"))
      : null;
    const existing = anchor?.getAttribute("href") ?? "https://";
    const url = prompt("Enter URL:", existing);
    if (url) exec("createLink", url);
  }

  const toolbarGroups = [
    {
      label: "Text",
      buttons: [
        { icon: <Type className="h-3.5 w-3.5" />, action: () => exec("formatBlock", "p"), title: "Paragraph", activeKey: "p" },
        { icon: <Heading2 className="h-3.5 w-3.5" />, action: () => exec("formatBlock", "h2"), title: "Heading 2 (H2)", activeKey: "h2" },
        { icon: <Heading3 className="h-3.5 w-3.5" />, action: () => exec("formatBlock", "h3"), title: "Heading 3 (H3)", activeKey: "h3" },
      ],
    },
    {
      label: "Format",
      buttons: [
        { icon: <Bold className="h-3.5 w-3.5" />, action: () => exec("bold"), title: "Bold (Ctrl+B)", activeKey: "bold" },
        { icon: <Italic className="h-3.5 w-3.5" />, action: () => exec("italic"), title: "Italic (Ctrl+I)", activeKey: "italic" },
        { icon: <Underline className="h-3.5 w-3.5" />, action: () => exec("underline"), title: "Underline (Ctrl+U)", activeKey: "underline" },
      ],
    },
    {
      label: "Insert",
      buttons: [
        { icon: <Link className="h-3.5 w-3.5" />, action: insertLink, title: "Insert Link (Ctrl+K)", activeKey: undefined },
        { icon: <List className="h-3.5 w-3.5" />, action: () => exec("insertUnorderedList"), title: "Bullet List", activeKey: "insertUnorderedList" },
        { icon: <ListOrdered className="h-3.5 w-3.5" />, action: () => exec("insertOrderedList"), title: "Numbered List", activeKey: "insertOrderedList" },
        { icon: <Minus className="h-3.5 w-3.5" />, action: () => exec("insertHorizontalRule"), title: "Horizontal Rule", activeKey: undefined },
      ],
    },
    {
      label: "Align",
      buttons: [
        { icon: <AlignLeft className="h-3.5 w-3.5" />, action: () => exec("justifyLeft"), title: "Align Left", activeKey: undefined },
        { icon: <AlignCenter className="h-3.5 w-3.5" />, action: () => exec("justifyCenter"), title: "Align Centre", activeKey: "justifyCenter" },
      ],
    },
  ];

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-input bg-muted/30 p-1.5">
        {toolbarGroups.map((group, gi) => (
          <div key={group.label} className="flex items-center">
            {gi > 0 && <div className="mx-1 h-5 w-px bg-border" />}
            {group.buttons.map((btn) => {
              const isActive = btn.activeKey ? activeFormats.has(btn.activeKey) : false;
              return (
                <button
                  key={btn.title}
                  type="button"
                  onMouseDown={(e) => {
                    // Prevent editor blur so selection is preserved when clicking toolbar
                    e.preventDefault();
                    btn.action();
                  }}
                  title={btn.title}
                  className={cn(
                    "rounded p-1.5 transition-colors",
                    isActive
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:bg-background hover:text-foreground"
                  )}
                >
                  {btn.icon}
                </button>
              );
            })}
          </div>
        ))}

        <div className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            if (editorRef.current) {
              const isSource = editorRef.current.getAttribute("data-source") === "true";
              if (isSource) {
                editorRef.current.innerHTML = editorRef.current.innerText;
                editorRef.current.removeAttribute("data-source");
                editorRef.current.style.fontFamily = "";
                editorRef.current.style.fontSize = "";
                editorRef.current.style.whiteSpace = "";
                handleInput();
              } else {
                editorRef.current.innerText = editorRef.current.innerHTML;
                editorRef.current.setAttribute("data-source", "true");
                editorRef.current.style.fontFamily = "monospace";
                editorRef.current.style.fontSize = "12px";
                editorRef.current.style.whiteSpace = "pre-wrap";
              }
            }
          }}
          title="Toggle HTML Source"
          className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
        >
          <Code className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Variables bar */}
      <div className="flex flex-wrap items-center gap-1.5 px-1">
        <span className="text-xs text-muted-foreground">Insert variable:</span>
        {variables.map((v) => (
          <Badge
            key={v.key}
            variant="outline"
            className="cursor-pointer text-xs hover:bg-[#8BA889]/10 hover:border-[#8BA889]/40 transition-colors"
            onMouseDown={(e) => { e.preventDefault(); insertVariable(v.key); }}
            title={v.description}
          >
            {`{{${v.key}}}`}
          </Badge>
        ))}
      </div>

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className="rounded-md border border-input bg-background px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground/50 [&_p]:mb-[1em] [&_p:last-child]:mb-0 [&_ul]:mb-[1em] [&_ol]:mb-[1em] [&_ul:last-child]:mb-0 [&_ol:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-[0.75em] [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-[0.5em] [&_a]:text-brand-600 [&_a]:underline"
        style={{ minHeight, lineHeight: 1.6 }}
        suppressContentEditableWarning
      />
    </div>
  );
}
