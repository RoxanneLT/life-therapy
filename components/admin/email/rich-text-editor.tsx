"use client";

import { useRef, useCallback, useEffect } from "react";
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

  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
    isInternalChange.current = false;
  }, [value]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  function exec(command: string, val?: string) {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    handleInput();
  }

  function insertVariable(variable: string) {
    const html = `<span style="background: #f0f4f0; color: #5a7a58; padding: 1px 6px; border-radius: 4px; font-size: 13px; font-family: monospace;">\{\{${variable}\}\}</span>&nbsp;`;
    exec("insertHTML", html);
  }

  function insertLink() {
    const url = prompt("Enter URL:", "https://");
    if (url) {
      exec("createLink", url);
    }
  }

  function formatBlock(tag: string) {
    exec("formatBlock", tag);
  }

  const toolbarGroups = [
    {
      label: "Text",
      buttons: [
        { icon: <Type className="h-3.5 w-3.5" />, action: () => formatBlock("p"), title: "Paragraph" },
        { icon: <Heading2 className="h-3.5 w-3.5" />, action: () => formatBlock("h2"), title: "Heading 2" },
        { icon: <Heading3 className="h-3.5 w-3.5" />, action: () => formatBlock("h3"), title: "Heading 3" },
      ],
    },
    {
      label: "Format",
      buttons: [
        { icon: <Bold className="h-3.5 w-3.5" />, action: () => exec("bold"), title: "Bold" },
        { icon: <Italic className="h-3.5 w-3.5" />, action: () => exec("italic"), title: "Italic" },
        { icon: <Underline className="h-3.5 w-3.5" />, action: () => exec("underline"), title: "Underline" },
      ],
    },
    {
      label: "Insert",
      buttons: [
        { icon: <Link className="h-3.5 w-3.5" />, action: insertLink, title: "Insert Link" },
        { icon: <List className="h-3.5 w-3.5" />, action: () => exec("insertUnorderedList"), title: "Bullet List" },
        { icon: <ListOrdered className="h-3.5 w-3.5" />, action: () => exec("insertOrderedList"), title: "Numbered List" },
        { icon: <Minus className="h-3.5 w-3.5" />, action: () => exec("insertHorizontalRule"), title: "Horizontal Rule" },
      ],
    },
    {
      label: "Align",
      buttons: [
        { icon: <AlignLeft className="h-3.5 w-3.5" />, action: () => exec("justifyLeft"), title: "Align Left" },
        { icon: <AlignCenter className="h-3.5 w-3.5" />, action: () => exec("justifyCenter"), title: "Align Center" },
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
            {group.buttons.map((btn) => (
              <button
                key={btn.title}
                type="button"
                onClick={btn.action}
                title={btn.title}
                className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
              >
                {btn.icon}
              </button>
            ))}
          </div>
        ))}

        <div className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          onClick={() => {
            if (editorRef.current) {
              const isSource = editorRef.current.getAttribute("data-source") === "true";
              if (isSource) {
                editorRef.current.innerHTML = editorRef.current.innerText;
                editorRef.current.removeAttribute("data-source");
                editorRef.current.style.fontFamily = "";
                editorRef.current.style.fontSize = "";
                editorRef.current.style.whiteSpace = "";
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
            onClick={() => insertVariable(v.key)}
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
        data-placeholder={placeholder}
        className="rounded-md border border-input bg-background px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground/50"
        style={{ minHeight, lineHeight: 1.6 }}
        dangerouslySetInnerHTML={{ __html: value }}
        suppressContentEditableWarning
      />
    </div>
  );
}
