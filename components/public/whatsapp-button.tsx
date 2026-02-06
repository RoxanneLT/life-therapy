"use client";

import { MessageCircle } from "lucide-react";

interface WhatsAppButtonProps {
  readonly whatsappNumber: string;
}

export function WhatsAppButton({ whatsappNumber }: WhatsAppButtonProps) {
  const url = `https://wa.me/${whatsappNumber}?text=Hi%20Roxanne%2C%20I%27d%20like%20to%20find%20out%20more%20about%20Life-Therapy.`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
