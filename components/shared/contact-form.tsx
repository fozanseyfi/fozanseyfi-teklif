"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageSquare, Bug, Lightbulb, HelpCircle, Send, Mail } from "lucide-react";

const TOPICS = [
  { value: "general", label: "Genel Geri Bildirim", icon: MessageSquare },
  { value: "bug", label: "Hata Bildirimi", icon: Bug },
  { value: "feature", label: "Özellik Önerisi", icon: Lightbulb },
  { value: "question", label: "Soru / Yardım", icon: HelpCircle },
] as const;

type Topic = (typeof TOPICS)[number]["value"];

interface Props {
  recipientEmail: string;
  senderEmail?: string;
}

export function ContactForm({ recipientEmail }: Props) {
  const [topic, setTopic] = useState<Topic>("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const messageLength = message.length;
  const minLength = 10;
  const valid = subject.trim().length > 0 && messageLength >= minLength;

  function buildMailto() {
    const topicLabel = TOPICS.find((t) => t.value === topic)?.label ?? "";
    const fullSubject = `[SolarTeklif – ${topicLabel}] ${subject}`;
    const params = new URLSearchParams({
      subject: fullSubject,
      body: message,
    });
    return `mailto:${recipientEmail}?${params.toString()}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    window.location.href = buildMailto();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Topic chooser */}
      <div className="space-y-1.5">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Konu Türü
        </Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TOPICS.map((t) => {
            const isSelected = topic === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTopic(t.value)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-md border px-2 py-3 text-xs font-medium transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-pressed={isSelected}
              >
                <t.icon className="size-4" />
                <span className="text-center leading-tight">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <Label
          htmlFor="contact-subject"
          className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Konu
        </Label>
        <Input
          id="contact-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Kısa bir özet — örn: PDF çıktısında font sorunu"
          required
        />
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <Label
          htmlFor="contact-message"
          className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Mesaj
        </Label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Detaylı açıklama: hangi sayfada, hangi adımda yaşandı, ne bekleniyordu, ne oldu?"
          rows={5}
          minLength={minLength}
          required
          className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>En az {minLength} karakter</span>
          <span className={cn(messageLength >= minLength && "text-success-soft-foreground")}>
            {messageLength} karakter
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <a
          href={`mailto:${recipientEmail}`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Mail className="size-4" />
          E-posta ile Gönder
        </a>
        <Button type="submit" disabled={!valid}>
          <Send className="size-4" />
          Gönder
        </Button>
      </div>
    </form>
  );
}
