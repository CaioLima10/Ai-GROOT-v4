"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./MessageRenderer.module.css";
import type { ChecklistItem, GIOMMessage, TableContent, TimelineItem } from "./types";

type CopyHandlerResult = void | boolean | Promise<void | boolean>;

type MessageRendererProps = {
  message: GIOMMessage;
  onCopy?: (value: string) => CopyHandlerResult;
  onEdit?: (value: string) => void;
};

type BlockFrameProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onCopy?: () => CopyHandlerResult;
  onEdit?: () => void;
  onPreview?: () => void;
  extraActions?: React.ReactNode;
};

function IconCopy() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M5.5 12.5l4 4L18.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 20h4l10-10-4-4L4 16v4Z" strokeLinejoin="round" />
      <path d="M12 6l4 4" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M14.5 6.5 9 12l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M9.5 6.5 15 12l-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPreview() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M12 4v10" strokeLinecap="round" />
      <path d="M8 10l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" strokeLinecap="round" />
    </svg>
  );
}

function IconCode() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M8 9l-4 3 4 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 9l4 3-4 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 5l-4 14" strokeLinecap="round" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" strokeLinejoin="round" />
      <path d="M14 3v5h5" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h6" strokeLinecap="round" />
    </svg>
  );
}

function IconPrompt() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconChecklist() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11" strokeLinecap="round" />
      <path d="M4 6l1.5 1.5L7.8 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12l1.5 1.5L7.8 11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 18l1.5 1.5L7.8 17" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTable() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16M15 4v16" />
    </svg>
  );
}

function IconTimeline() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 12h16" strokeLinecap="round" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="18" cy="12" r="2" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8" cy="9" r="1.5" />
      <path d="M21 16l-5-5-4 4-2-2-4 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <path d="M17 10l4-2v8l-4-2" strokeLinejoin="round" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" strokeLinejoin="round" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function IconData() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 19h16" strokeLinecap="round" />
      <rect x="6" y="11" width="3" height="8" rx="1" />
      <rect x="11" y="8" width="3" height="11" rx="1" />
      <rect x="16" y="5" width="3" height="14" rx="1" />
    </svg>
  );
}

function useCopyFeedback(onCopy?: () => CopyHandlerResult) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    if (!onCopy) return;

    try {
      const result = await Promise.resolve(onCopy());
      if (result === false) return;
    } catch {
      return;
    }

    setCopied(true);

    if (typeof window !== "undefined") {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }

      resetTimerRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    }
  }

  return { copied, handleCopy };
}

function BlockFrame({ title, icon, children, onCopy, onEdit, onPreview, extraActions }: BlockFrameProps) {
  const { copied, handleCopy } = useCopyFeedback(onCopy);

  return (
    <section className={styles.blockFrame}>
      <header className={styles.blockHead}>
        <span className={styles.blockTitle}>
          {icon}
          {title}
        </span>
        <div className={styles.blockActions}>
          {onCopy && (
            <button
              type="button"
              className={`${styles.actionBtn} ${copied ? styles.actionBtnCopied : ""}`.trim()}
              onClick={() => void handleCopy()}
              aria-label={copied ? `${title} copiado` : `Copiar ${title}`}
              title={copied ? `${title} copiado` : `Copiar ${title}`}
            >
              {copied ? <IconCheck /> : <IconCopy />}
              {copied ? <span className={styles.actionBtnLabel}>Copiado</span> : null}
            </button>
          )}
          {onEdit && (
            <button type="button" className={styles.actionBtn} onClick={onEdit} aria-label={`Editar ${title}`} title={`Editar ${title}`}>
              <IconEdit />
            </button>
          )}
          {onPreview && (
            <button type="button" className={styles.actionBtn} onClick={onPreview} aria-label={`Preview ${title}`} title={`Preview ${title}`}>
              <IconPreview />
            </button>
          )}
          {extraActions}
        </div>
      </header>
      <div className={styles.content}>{children}</div>
    </section>
  );
}

type CodeToken = {
  kind: "keyword" | "string" | "number" | "comment" | "function" | "plain";
  value: string;
};

function tokenizeCode(code = ""): CodeToken[] {
  const source = String(code || "");
  const pattern = /(\/\/.*$|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|return|if|else|switch|case|break|continue|for|while|try|catch|finally|throw|class|extends|new|import|export|from|async|await|true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b|\b([A-Za-z_$][\w$]*)\s*(?=\())/gm;
  const tokens: CodeToken[] = [];
  let cursor = 0;

  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      tokens.push({ kind: "plain", value: source.slice(cursor, index) });
    }

    const value = match[0];
    let kind: CodeToken["kind"] = "plain";
    if (/^\/\//.test(value) || /^\/\*/.test(value)) kind = "comment";
    else if (/^['"`]/.test(value)) kind = "string";
    else if (/^\d/.test(value)) kind = "number";
    else if (match[1]) kind = "function";
    else if (/^(const|let|var|function|return|if|else|switch|case|break|continue|for|while|try|catch|finally|throw|class|extends|new|import|export|from|async|await|true|false|null|undefined)$/.test(value)) kind = "keyword";

    tokens.push({ kind, value });
    cursor = index + value.length;
  }

  if (cursor < source.length) {
    tokens.push({ kind: "plain", value: source.slice(cursor) });
  }

  return tokens;
}

function cleanPlainText(value: string) {
  return String(value || "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeRemoteImageUrl(value: unknown) {
  const cleaned = cleanPlainText(String(value ?? ""));
  return /^https?:\/\//i.test(cleaned) ? cleaned : "";
}

function cleanPromptText(value: string) {
  return cleanPlainText(value)
    .replace(/^```(?:[a-zA-Z0-9_-]+)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type WeatherTone = "sun" | "partly" | "cloud" | "rain" | "storm" | "snow" | "night";
type WeatherMetricKey = "high" | "low" | "wind" | "rain" | "uv" | "precip";

function resolveWeatherTone(code: unknown, isDay = true): WeatherTone {
  const numeric = Number(code);
  if (!Number.isFinite(numeric)) {
    return isDay ? "sun" : "night";
  }
  if ([95, 96, 99].includes(numeric)) return "storm";
  if ([71, 73, 75, 77, 85, 86].includes(numeric)) return "snow";
  if ([61, 63, 65, 66, 67, 80, 81, 82, 51, 53, 55, 56, 57].includes(numeric)) return "rain";
  if ([45, 48].includes(numeric)) return "cloud";
  if ([1, 2].includes(numeric)) return isDay ? "partly" : "night";
  if (numeric === 3) return "cloud";
  return isDay ? "sun" : "night";
}

function formatWeatherNumber(value: unknown) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return String(Math.round(numeric));
  }

  const fallback = cleanPlainText(String(value ?? "")).replace(/[^\d-]/g, "");
  return fallback || "--";
}

function formatWeatherDegree(value: unknown) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return `${Math.round(numeric)}°`;
  }

  const fallback = cleanPlainText(String(value ?? ""));
  if (!fallback || fallback === "--") {
    return "--";
  }

  return fallback.includes("°") ? fallback : `${fallback}°`;
}

function formatWeatherTimestamp(value: unknown, timezone: unknown) {
  const input = cleanPlainText(String(value ?? ""));
  if (!input) {
    return "";
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit"
  };
  const safeTimezone = cleanPlainText(String(timezone ?? "")).trim();
  if (safeTimezone && safeTimezone.toLowerCase() !== "auto") {
    options.timeZone = safeTimezone;
  }

  return new Intl.DateTimeFormat("pt-BR", options).format(parsed);
}

function describeWeatherLocationSourceLabel(value: unknown) {
  const normalized = cleanPlainText(String(value ?? "")).trim().toLowerCase();
  if (normalized === "browser_geolocation") return "Localizacao confirmada no navegador";
  if (normalized === "city_query" || normalized === "named_query") return "Local confirmado na consulta";
  if (normalized === "recent_weather_memory") return "Local mantido da ultima consulta de clima";
  if (normalized === "ip_approximate") return "Local aproximado por rede";
  return cleanPlainText(String(value ?? ""));
}

function describeWeatherLocationTypeLabel(value: unknown) {
  const normalized = cleanPlainText(String(value ?? "")).trim().toLowerCase();
  if (normalized === "municipality") return "Municipio";
  if (normalized === "city") return "Cidade";
  if (normalized === "state") return "Estado";
  if (normalized === "country") return "Pais";
  return "Local";
}

function asWeatherEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Record<string, unknown>[];
  }

  return value
    .map((entry) => (entry && typeof entry === "object" ? entry as Record<string, unknown> : null))
    .filter(Boolean) as Record<string, unknown>[];
}

function formatWeatherWeekLabel(entry: Record<string, unknown>, index: number) {
  const direct = cleanPlainText(String(entry.label || entry.weekday || entry.day || ""));
  if (direct) {
    return direct;
  }

  const isoDate = String(entry.isoDate || entry.date || "");
  if (!isoDate) {
    return `Dia ${index + 1}`;
  }

  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(new Date(`${isoDate}T12:00:00`))
    .replace(/\.$/, "");
}

function formatWeatherDayNumber(entry: Record<string, unknown>, index: number) {
  const direct = cleanPlainText(String(entry.dayNumber || ""));
  if (direct) {
    return direct;
  }

  const isoDate = String(entry.isoDate || entry.date || "");
  if (!isoDate) {
    return String(index + 1).padStart(2, "0");
  }

  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(new Date(`${isoDate}T12:00:00`));
}

function WeatherGlyph({ weatherCode, isDay = true, className = "" }: { weatherCode: unknown; isDay?: boolean; className?: string }) {
  const tone = resolveWeatherTone(weatherCode, isDay);
  const toneClassMap: Record<WeatherTone, string> = {
    sun: styles.weatherGlyphSun,
    partly: styles.weatherGlyphPartly,
    cloud: styles.weatherGlyphCloudy,
    rain: styles.weatherGlyphRainy,
    storm: styles.weatherGlyphStormy,
    snow: styles.weatherGlyphSnowy,
    night: styles.weatherGlyphNight
  };

  return (
    <span className={[styles.weatherGlyph, toneClassMap[tone], className].filter(Boolean).join(" ")} aria-hidden="true">
      <span className={styles.weatherGlyphOrb} />
      <span className={styles.weatherGlyphMoon} />
      <span className={styles.weatherGlyphCloudBase} />
      <span className={`${styles.weatherGlyphCloudBase} ${styles.weatherGlyphCloudBaseAlt}`} />
      <span className={styles.weatherGlyphDrops} />
      <span className={styles.weatherGlyphSnowDots} />
    </span>
  );
}

function WeatherMetricGlyph({ metricKey }: { metricKey: WeatherMetricKey }) {
  const commonProps = {
    className: styles.weatherMetricIconSvg,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  if (metricKey === "high") {
    return (
      <svg {...commonProps}>
        <path d="M12 18V7" />
        <path d="m8.5 10.5 3.5-3.5 3.5 3.5" />
        <path d="M6 19h12" />
      </svg>
    );
  }

  if (metricKey === "low") {
    return (
      <svg {...commonProps}>
        <path d="M12 6v11" />
        <path d="m8.5 13.5 3.5 3.5 3.5-3.5" />
        <path d="M6 5h12" />
      </svg>
    );
  }

  if (metricKey === "wind") {
    return (
      <svg {...commonProps}>
        <path d="M4 9h8c1.8 0 2.7-.9 2.7-2.1A2.1 2.1 0 0 0 12.6 4.8c-1 0-1.8.4-2.3 1.2" />
        <path d="M4 13h12c2.1 0 3.2 1 3.2 2.4A2.6 2.6 0 0 1 16.6 18c-1.2 0-2.2-.5-2.8-1.4" />
        <path d="M4 17h6" />
      </svg>
    );
  }

  if (metricKey === "rain") {
    return (
      <svg {...commonProps}>
        <path d="M7.2 16.5a4.2 4.2 0 1 1 .5-8.4A5.3 5.3 0 0 1 18.5 10a3.3 3.3 0 0 1-.6 6.5H7.2Z" />
        <path d="m9 18.2-.8 1.8" />
        <path d="m13 18.2-.8 1.8" />
        <path d="m17 18.2-.8 1.8" />
      </svg>
    );
  }

  if (metricKey === "uv") {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="3.3" />
        <path d="M12 3.8v2.1" />
        <path d="M12 18.1v2.1" />
        <path d="m6.2 6.2 1.5 1.5" />
        <path d="m16.3 16.3 1.5 1.5" />
        <path d="M3.8 12h2.1" />
        <path d="M18.1 12h2.1" />
        <path d="m6.2 17.8 1.5-1.5" />
        <path d="m16.3 7.7 1.5-1.5" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M12 4.5c2.3 3.1 4.5 5.8 4.5 8.5A4.5 4.5 0 1 1 7.5 13c0-2.7 2.2-5.4 4.5-8.5Z" />
      <path d="M7.2 18.4h9.6" />
      <path d="M9.4 21h5.2" />
    </svg>
  );
}

type PromptRenderableBlock =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "unordered"; items: string[] }
  | { kind: "ordered"; items: string[] };

type PromptDocumentSection = {
  heading?: string;
  blocks: PromptRenderableBlock[];
};

function resolvePromptString(content: MessageRendererProps["message"]["content"]) {
  if (typeof content === "string") {
    return cleanPromptText(content);
  }

  if (Array.isArray(content)) {
    return cleanPromptText(content.map((item) => String(item ?? "")).join("\n"));
  }

  if (content && typeof content === "object") {
    const record = content as Record<string, unknown>;
    const directText = [
      record.content,
      record.text,
      record.prompt,
      record.body,
      record.value,
      record.instructions
    ].find((value) => typeof value === "string" && value.trim());

    if (typeof directText === "string") {
      return cleanPromptText(directText);
    }

    if (Array.isArray(record.sections)) {
      const assembled = record.sections
        .map((entry) => {
          if (!entry || typeof entry !== "object") return "";
          const section = entry as Record<string, unknown>;
          const heading = typeof section.heading === "string" ? section.heading.trim() : "";
          const body = typeof section.body === "string" ? section.body.trim() : "";
          return [heading, body].filter(Boolean).join("\n");
        })
        .filter(Boolean)
        .join("\n\n");

      if (assembled) {
        return cleanPromptText(assembled);
      }
    }

    return cleanPromptText(JSON.stringify(content, null, 2));
  }

  return "";
}

function buildPromptBlocks(value: string): PromptRenderableBlock[] {
  const blocks: PromptRenderableBlock[] = [];
  const lines = String(value || "").split("\n");
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    const cleaned = paragraphBuffer.map((line) => line.trimEnd()).filter((line) => line.trim());
    if (cleaned.length) {
      blocks.push({ kind: "paragraph", lines: cleaned });
    }
    paragraphBuffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] || "";
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      flushParagraph();
      const items: string[] = [];
      let cursor = index;
      while (cursor < lines.length) {
        const candidate = String(lines[cursor] || "").trim();
        if (!candidate) break;
        const match = candidate.match(/^[-*•]\s+(.*)$/);
        if (!match) break;
        items.push(match[1].trim());
        cursor += 1;
      }
      if (items.length) {
        blocks.push({ kind: "unordered", items });
        index = cursor - 1;
        continue;
      }
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      const items: string[] = [];
      let cursor = index;
      while (cursor < lines.length) {
        const candidate = String(lines[cursor] || "").trim();
        if (!candidate) break;
        const match = candidate.match(/^\d+\.\s+(.*)$/);
        if (!match) break;
        items.push(match[1].trim());
        cursor += 1;
      }
      if (items.length) {
        blocks.push({ kind: "ordered", items });
        index = cursor - 1;
        continue;
      }
    }

    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

function isPromptLeadParagraph(lines: string[]) {
  if (lines.length !== 1) return false;
  const line = String(lines[0] || "").trim();
  if (!line) return false;
  return (
    /:\s*$/.test(line) ||
    /^[^\w\s]?\s*[A-ZÀ-Ý0-9][A-ZÀ-Ý0-9\s_-]{4,}:?$/.test(line)
  );
}

function buildPromptDocument(value: string): PromptDocumentSection[] {
  const blocks = buildPromptBlocks(value);
  const sections: PromptDocumentSection[] = [];
  let currentSection: PromptDocumentSection = { blocks: [] };

  const pushCurrentSection = () => {
    if (currentSection.heading || currentSection.blocks.length) {
      sections.push(currentSection);
    }
    currentSection = { blocks: [] };
  };

  for (const block of blocks) {
    if (block.kind === "paragraph" && isPromptLeadParagraph(block.lines)) {
      pushCurrentSection();
      currentSection = {
        heading: String(block.lines[0] || "").trim(),
        blocks: []
      };
      continue;
    }

    currentSection.blocks.push(block);
  }

  pushCurrentSection();
  return sections;
}

function formatLanguageLabel(language = "") {
  const normalized = String(language || "text").trim().toLowerCase();
  if (!normalized) return "Texto";
  if (normalized === "html") return "HTML";
  if (normalized === "css") return "CSS";
  if (normalized === "javascript" || normalized === "js") return "JavaScript";
  if (normalized === "typescript" || normalized === "ts") return "TypeScript";
  if (normalized === "json") return "JSON";
  if (normalized === "sql") return "SQL";
  if (normalized === "python" || normalized === "py") return "Python";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function TextMessage({ message, onCopy, onEdit }: MessageRendererProps) {
  const rawValue = typeof message.content === "string" ? message.content : JSON.stringify(message.content, null, 2);
  const value = cleanPlainText(rawValue);
  void onCopy;
  void onEdit;
  return (
    <p className={`${styles.text} ${styles.plainText}`}>{value}</p>
  );
}

export function CodeBlock({ message, onCopy, onEdit }: MessageRendererProps) {
  const value = typeof message.content === "string" ? message.content : JSON.stringify(message.content, null, 2);
  const language = message.language || String(message.meta?.language || "text");
  const languageLabel = formatLanguageLabel(language);
  const tokens = useMemo(() => tokenizeCode(value), [value]);
  const title = String(language).trim().toLowerCase() === "html" ? "Estrutura completa (copia e cola)" : "Codigo pronto (copia e cola)";
  const { copied, handleCopy } = useCopyFeedback(onCopy ? () => onCopy(value) : undefined);

  return (
    <section className={styles.codeShell}>
      <header className={styles.codeShellHeader}>
        <span className={styles.codeShellTitle}>
          <IconDocument />
          {title}
        </span>
      </header>
      <article className={styles.codeCard}>
        <div className={styles.codeMeta}>
          <span className={styles.codeLanguage}>
            <IconCode />
            {languageLabel}
          </span>
          <div className={styles.codeActions}>
            {onCopy && (
              <button
                type="button"
                className={`${styles.actionBtn} ${copied ? styles.actionBtnCopied : ""}`.trim()}
                onClick={() => void handleCopy()}
                aria-label={copied ? `${title} copiado` : `Copiar ${title}`}
                title={copied ? `${title} copiado` : `Copiar ${title}`}
              >
                {copied ? <IconCheck /> : <IconCopy />}
                {copied ? <span className={styles.actionBtnLabel}>Copiado</span> : null}
              </button>
            )}
            {onEdit && (
              <button type="button" className={styles.actionBtn} onClick={() => onEdit(value)} aria-label={`Editar ${title}`} title={`Editar ${title}`}>
                <IconEdit />
              </button>
            )}
          </div>
        </div>
        <div className={styles.codeWrap}>
          <pre className={styles.code}>
            <code>
              {tokens.map((token, index) => (
                <span key={`${message.id}-code-${index}`} className={styles[`token_${token.kind}`]}>
                  {token.value}
                </span>
              ))}
            </code>
          </pre>
        </div>
      </article>
    </section>
  );
}

export function DocumentBlock({ message, onCopy, onEdit }: MessageRendererProps) {
  const doc = typeof message.content === "string"
    ? { title: "Documento", sections: [{ heading: "Conteudo", body: cleanPlainText(message.content) }] }
    : (message.content as { title?: string; sections?: Array<{ heading?: string; body?: string }> });

  const plain = JSON.stringify(doc, null, 2);

  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <BlockFrame
      title="Documento"
      icon={<IconDocument />}
      onCopy={onCopy ? () => onCopy(plain) : undefined}
      onEdit={onEdit ? () => onEdit(plain) : undefined}
      onPreview={() => setPreviewOpen((current) => !current)}
      extraActions={
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => {
            const base64 = String(message.meta?.base64 || "");
            const mimeType = String(message.meta?.mimeType || "application/octet-stream");
            const fileName = String(message.meta?.fileName || `documento-${message.id}.txt`);
            if (!base64 || typeof window === "undefined") return;
            const bytes = atob(base64);
            const array = new Uint8Array(bytes.length);
            for (let index = 0; index < bytes.length; index += 1) {
              array[index] = bytes.charCodeAt(index);
            }
            const blob = new Blob([array], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
          }}
          aria-label="Download documento"
          title="Download documento"
        >
          <IconDownload />
        </button>
      }
    >
      <h3 className={styles.documentTitle}>{doc.title || "Documento GIOM"}</h3>
      {(doc.sections || []).map((section, index) => (
        <article key={`${message.id}-section-${index}`} className={styles.documentSection}>
          <h4>{cleanPlainText(section.heading || `Secao ${index + 1}`)}</h4>
          <p>{cleanPlainText(section.body || "")}</p>
        </article>
      ))}
      {!doc.sections?.length && <p className={styles.text}>{typeof message.content === "string" ? cleanPlainText(message.content) : plain}</p>}
      {previewOpen && <p className={styles.previewNote}>Preview ativo: estrutura do documento renderizada em secoes.</p>}
    </BlockFrame>
  );
}

export function PromptBlock({ message, onCopy, onEdit }: MessageRendererProps) {
  const promptValue = useMemo(() => resolvePromptString(message.content), [message.content]);
  const promptSections = useMemo(() => buildPromptDocument(promptValue), [promptValue]);
  const { copied, handleCopy } = useCopyFeedback(onCopy ? () => onCopy(promptValue) : undefined);
  void onEdit;
  return (
    <section className={styles.promptShell}>
      <header className={styles.promptShellHeader}>
        <span className={styles.promptShellTitle}>
          <IconPrompt />
          PROMPT PRONTO (COPIA E COLA)
        </span>
      </header>
      <article className={styles.promptCard}>
        <div className={styles.promptTopBar}>
          <small className={styles.promptEyebrow}>Escrita</small>
          {onCopy && (
            <button
              type="button"
              className={`${styles.promptCopyBtn} ${copied ? styles.promptCopyBtnCopied : ""}`.trim()}
              onClick={() => void handleCopy()}
              aria-label={copied ? "Prompt copiado" : "Copiar prompt"}
              title={copied ? "Prompt copiado" : "Copiar prompt"}
            >
              {copied ? <IconCheck /> : <IconCopy />}
              {copied ? <span className={styles.promptCopyLabel}>Copiado</span> : null}
            </button>
          )}
        </div>
        <div className={styles.promptDocument}>
          {promptSections.map((section, sectionIndex) => (
            <section key={`${message.id}-prompt-section-${sectionIndex}`} className={styles.promptSection}>
              {section.heading ? <h3 className={styles.promptSectionTitle}>{section.heading}</h3> : null}
              <div className={styles.promptSectionBody}>
                {section.blocks.map((block, blockIndex) => {
                  if (block.kind === "unordered") {
                    return (
                      <ul key={`${message.id}-prompt-ul-${sectionIndex}-${blockIndex}`} className={styles.promptList}>
                        {block.items.map((item, itemIndex) => (
                          <li key={`${message.id}-prompt-ul-item-${sectionIndex}-${blockIndex}-${itemIndex}`}>{item}</li>
                        ))}
                      </ul>
                    );
                  }

                  if (block.kind === "ordered") {
                    return (
                      <ol key={`${message.id}-prompt-ol-${sectionIndex}-${blockIndex}`} className={styles.promptOrderedList}>
                        {block.items.map((item, itemIndex) => (
                          <li key={`${message.id}-prompt-ol-item-${sectionIndex}-${blockIndex}-${itemIndex}`}>{item}</li>
                        ))}
                      </ol>
                    );
                  }

                  return (
                    <p
                      key={`${message.id}-prompt-p-${sectionIndex}-${blockIndex}`}
                      className={`${styles.promptParagraph} ${isPromptLeadParagraph(block.lines) ? styles.promptLeadParagraph : ""}`.trim()}
                    >
                      {block.lines.map((line, lineIndex) => (
                        <span key={`${message.id}-prompt-line-${sectionIndex}-${blockIndex}-${lineIndex}`}>
                          {line}
                          {lineIndex < block.lines.length - 1 ? <br /> : null}
                        </span>
                      ))}
                    </p>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </article>
    </section>
  );
}

export function ChecklistBlock({ message, onCopy, onEdit }: MessageRendererProps) {
  const items = useMemo(() => {
    if (Array.isArray(message.content)) {
      return message.content.map((entry, index) => {
        if (typeof entry === "string") return { id: `i-${index}`, label: entry, checked: false } as ChecklistItem;
        const item = entry as ChecklistItem;
        return { id: item.id || `i-${index}`, label: item.label || `Item ${index + 1}`, checked: Boolean(item.checked) };
      });
    }

    if (typeof message.content === "string") {
      return message.content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
          const match = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
          if (match) return { id: `i-${index}`, label: match[2], checked: match[1].toLowerCase() === "x" };
          return { id: `i-${index}`, label: line.replace(/^[-*]\s+/, ""), checked: false };
        });
    }

    return [] as ChecklistItem[];
  }, [message.content]);

  const [localItems, setLocalItems] = useState(items);
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <BlockFrame
      title="Checklist"
      icon={<IconChecklist />}
      onCopy={onCopy ? () => onCopy(JSON.stringify(localItems, null, 2)) : undefined}
      onEdit={onEdit ? () => onEdit(localItems.map((item) => `- [${item.checked ? "x" : " "}] ${item.label}`).join("\n")) : undefined}
      onPreview={() => setPreviewOpen((current) => !current)}
    >
      <div className={styles.checklist}>
        {localItems.map((item, index) => (
          <label key={item.id || index} className={`${styles.checkItem} ${item.checked ? styles.checkItemDone : ""}`}>
            <input
              type="checkbox"
              checked={Boolean(item.checked)}
              onChange={() => {
                setLocalItems((current) =>
                  current.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, checked: !entry.checked } : entry
                  )
                );
              }}
              aria-label={item.label}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
      {previewOpen && <p className={styles.previewNote}>Preview ativo: checklist interativa pronta para acompanhar etapas.</p>}
    </BlockFrame>
  );
}

export function TableBlock({ message, onCopy, onEdit }: MessageRendererProps) {
  const content = useMemo(() => {
    if (typeof message.content !== "object" || !message.content) {
      return { columns: ["Valor"], rows: [[String(message.content || "")]] } as TableContent;
    }

    const value = message.content as Partial<TableContent>;
    return {
      columns: Array.isArray(value.columns) && value.columns.length ? value.columns.map(String) : ["Coluna"],
      rows: Array.isArray(value.rows) ? value.rows : []
    } as TableContent;
  }, [message.content]);

  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <BlockFrame
      title="Tabela"
      icon={<IconTable />}
      onCopy={onCopy ? () => onCopy(JSON.stringify(content, null, 2)) : undefined}
      onEdit={onEdit ? () => onEdit(JSON.stringify(content, null, 2)) : undefined}
      onPreview={() => setPreviewOpen((current) => !current)}
    >
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {content.columns.map((column) => (
                <th key={`${message.id}-${column}`}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.rows.map((row, rowIndex) => (
              <tr key={`${message.id}-row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${message.id}-cell-${rowIndex}-${cellIndex}`}>{String(cell ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {previewOpen && <p className={styles.previewNote}>Preview ativo: tabela estilo Notion com rolagem inteligente.</p>}
    </BlockFrame>
  );
}

export function TimelineBlock({ message, onCopy, onEdit }: MessageRendererProps) {
  const items = useMemo(() => {
    if (Array.isArray(message.content)) {
      return message.content.map((entry, index) => {
        if (typeof entry === "string") {
          return { id: `t-${index}`, title: entry, status: "pending" } as TimelineItem;
        }

        const item = entry as TimelineItem;
        return {
          id: item.id || `t-${index}`,
          title: item.title || `Etapa ${index + 1}`,
          time: item.time,
          description: item.description,
          status: item.status || "pending"
        };
      });
    }

    if (typeof message.content === "string") {
      return message.content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => ({ id: `t-${index}`, title: line, status: "pending" } as TimelineItem));
    }

    return [] as TimelineItem[];
  }, [message.content]);

  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <BlockFrame
      title="Timeline"
      icon={<IconTimeline />}
      onCopy={onCopy ? () => onCopy(JSON.stringify(items, null, 2)) : undefined}
      onEdit={onEdit ? () => onEdit(JSON.stringify(items, null, 2)) : undefined}
      onPreview={() => setPreviewOpen((current) => !current)}
    >
      <div className={styles.timeline}>
        {items.map((item, index) => (
          <article key={item.id || index} className={styles.timelineItem} title={item.description || item.title}>
            <span className={styles.timelineWhen}>{item.time || `Etapa ${index + 1}`}</span>
            <div className={styles.timelineBody}>
              <strong>{item.title}</strong>
              {item.description && <p>{item.description}</p>}
            </div>
          </article>
        ))}
      </div>
      {previewOpen && <p className={styles.previewNote}>Preview ativo: cronograma exibido em etapas legiveis.</p>}
    </BlockFrame>
  );
}

function downloadUrl(filename: string, url: string) {
  if (typeof window === "undefined") return;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.target = "_blank";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function toDataUrl(mimeType: string, base64: string) {
  return `data:${mimeType};base64,${base64}`;
}

export function ImageBlock({ message, onCopy, onEdit }: MessageRendererProps) {
  const payload = typeof message.content === "string"
    ? { url: message.content, alt: String(message.meta?.alt || "Imagem") }
    : (message.content as { url?: string; alt?: string; mimeType?: string; base64?: string; fileName?: string });

  const source = payload.url || (payload.base64 ? toDataUrl(payload.mimeType || "image/png", payload.base64) : "");
  const fileName = payload.fileName || `giom-image-${message.id}.png`;

  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <BlockFrame
      title="Imagem"
      icon={<IconImage />}
      onCopy={onCopy ? () => onCopy(source) : undefined}
      onEdit={onEdit ? () => onEdit(String(message.meta?.prompt || source)) : undefined}
      onPreview={() => setPreviewOpen((current) => !current)}
      extraActions={
        source ? (
          <button type="button" className={styles.actionBtn} onClick={() => downloadUrl(fileName, source)} aria-label="Download imagem" title="Download imagem">
            <IconDownload />
          </button>
        ) : undefined
      }
    >
      {source ? (
        <>
          <Image src={source} alt={payload.alt || "Imagem"} width={1280} height={960} className={styles.media} unoptimized />
          {previewOpen && <p className={styles.previewNote}>Preview ativo: imagem pronta para revisao visual.</p>}
        </>
      ) : (
        <p className={styles.text}>Imagem indisponivel.</p>
      )}
    </BlockFrame>
  );
}

export function VideoBlock({ message, onCopy, onEdit }: MessageRendererProps) {
  const payload = typeof message.content === "string"
    ? { url: message.content }
    : (message.content as { url?: string; title?: string });

  const url = payload.url || "";
  const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([\w-]+)/i);
  const embedUrl = youtubeMatch ? `https://www.youtube.com/embed/${youtubeMatch[1]}` : url;

  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <BlockFrame
      title="Video"
      icon={<IconVideo />}
      onCopy={onCopy ? () => onCopy(url) : undefined}
      onEdit={onEdit ? () => onEdit(url) : undefined}
      onPreview={() => setPreviewOpen((current) => !current)}
    >
      {embedUrl ? (
        <>
          <iframe
            src={embedUrl}
            title={payload.title || "Video"}
            className={`${styles.media} ${styles.videoFrame}`}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <div className={styles.mediaActions}>
            <a href={url} target="_blank" rel="noreferrer" className={styles.mediaLinkBtn}>
              Abrir fonte
            </a>
          </div>
          {previewOpen && <p className={styles.previewNote}>Preview ativo: player incorporado e pronto para uso.</p>}
        </>
      ) : (
        <p className={styles.text}>Video indisponivel.</p>
      )}
    </BlockFrame>
  );
}

export function MapBlock({ message, onCopy, onEdit }: MessageRendererProps) {
  const payload = typeof message.content === "string"
    ? { embedUrl: message.content }
    : (message.content as { embedUrl?: string; lat?: number; lng?: number; zoom?: number; label?: string });

  const embedUrl = payload.embedUrl || (payload.lat != null && payload.lng != null
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${payload.lng - 0.01}%2C${payload.lat - 0.01}%2C${payload.lng + 0.01}%2C${payload.lat + 0.01}&layer=mapnik&marker=${payload.lat}%2C${payload.lng}`
    : "");

  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <BlockFrame
      title="Mapa"
      icon={<IconMap />}
      onCopy={onCopy ? () => onCopy(embedUrl) : undefined}
      onEdit={onEdit ? () => onEdit(payload.label || embedUrl) : undefined}
      onPreview={() => setPreviewOpen((current) => !current)}
    >
      {embedUrl ? (
        <>
          <iframe src={embedUrl} title={payload.label || "Mapa"} className={`${styles.media} ${styles.mapFrame}`} />
          <div className={styles.mediaActions}>
            <a href={embedUrl} target="_blank" rel="noreferrer" className={styles.mediaLinkBtn}>
              Abrir mapa
            </a>
          </div>
          {previewOpen && <p className={styles.previewNote}>Preview ativo: mapa interativo em foco.</p>}
        </>
      ) : (
        <p className={styles.text}>Mapa indisponivel.</p>
      )}
    </BlockFrame>
  );
}

export function DataBlock({ message, onCopy, onEdit }: MessageRendererProps) {
  const data = useMemo(
    () => (typeof message.content === "object" && message.content
      ? (message.content as Record<string, unknown>)
      : { valor: message.content }),
    [message.content]
  );
  const variant = String(message.meta?.variant || "").trim().toLowerCase();
  const serializedData = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const { copied, handleCopy } = useCopyFeedback(onCopy ? () => onCopy(serializedData) : undefined);
  const weatherWeeklyData = data.weekly && typeof data.weekly === "object" && !Array.isArray(data.weekly)
    ? data.weekly as Record<string, unknown>
    : {};
  const weatherWeekDefaultOpen = variant === "weather" && Boolean(weatherWeeklyData.expandByDefault ?? data.expandByDefault);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeFixtureIndex, setActiveFixtureIndex] = useState(0);
  const [weatherWeekOpen, setWeatherWeekOpen] = useState(weatherWeekDefaultOpen);
  const weatherForecastRef = useRef<HTMLDivElement | null>(null);

  if (variant === "weather") {
    const location = cleanPlainText(String(data.location || data.city || data.place || "Clima"));
    const current = data.current && typeof data.current === "object"
      ? data.current as Record<string, unknown>
      : data;
    const weekly = data.weekly && typeof data.weekly === "object"
      ? data.weekly as Record<string, unknown>
      : {};
    const days = asWeatherEntries(weekly.days ?? data.days);
    const focusIndexRaw = Number(weekly.focusIndex ?? data.focusIndex ?? 0);
    const focusIndex = Number.isFinite(focusIndexRaw) ? Math.max(0, Math.min(days.length - 1, focusIndexRaw)) : 0;
    const dateLabel = cleanPlainText(String(current.dateLabel || data.dateLabel || "Hoje"));
    const condition = cleanPlainText(String(current.condition || data.condition || data.summary || ""));
    const note = cleanPlainText(String(current.note || data.note || data.alert || ""));
    const currentTemperature = formatWeatherNumber(current.temperature ?? data.temperature);
    const unit = cleanPlainText(String(current.unit || data.unit || "C")).toUpperCase();
    const unitLabel = currentTemperature !== "--" ? `°${unit}` : "";
    const high = formatWeatherDegree(current.high ?? data.high ?? data.max);
    const low = formatWeatherDegree(current.low ?? data.low ?? data.min);
    const uvValue = Number(current.uvIndex);
    const uvLabel = Number.isFinite(uvValue) ? String(Math.round(uvValue)) : "";
    const windValue = Number(current.windSpeed);
    const windLabel = Number.isFinite(windValue) ? `${Math.round(windValue)} km/h` : "";
    const rainChanceValue = Number(current.precipitationProbability ?? data.precipitationProbability);
    const rainChanceLabel = Number.isFinite(rainChanceValue) ? `${Math.round(rainChanceValue)}%` : "";
    const precipitationValue = Number(current.precipitation ?? data.precipitation);
    const precipitationLabel = Number.isFinite(precipitationValue) ? `${Math.round(precipitationValue)} mm` : "";
    const weeklyHint = cleanPlainText(String(weekly.focusLabel || `${days.length} dias disponiveis`));
    const currentIsDay = current.isDay !== false;
    const updatedLabel = formatWeatherTimestamp(current.fetchedAt ?? data.fetchedAt, current.timezone ?? data.timezone);
    const providerLabel = cleanPlainText(String(current.providerLabel || data.providerLabel || message.meta?.provider || "Open-Meteo"));
    const locationSourceLabel = describeWeatherLocationSourceLabel(current.locationSourceLabel || data.locationSourceLabel || data.locationSource || "");
    const locationTypeLabel = describeWeatherLocationTypeLabel(current.locationType || data.locationType || "");
    const liveCity = cleanPlainText(String(data.city || current.city || location.split(",")[0] || ""));
    const weatherMetrics = [
      high !== "--" ? { key: "high", label: "Maxima", value: high } : null,
      low !== "--" ? { key: "low", label: "Minima", value: low } : null,
      windLabel ? { key: "wind", label: "Vento", value: windLabel } : null,
      rainChanceLabel ? { key: "rain", label: "Chuva", value: rainChanceLabel } : null,
      uvLabel ? { key: "uv", label: "Indice UV", value: uvLabel } : null,
      precipitationLabel ? { key: "precip", label: "Acumulado", value: precipitationLabel } : null
    ].filter(Boolean) as Array<{ key: WeatherMetricKey; label: string; value: string }>;
    const weatherMetricToneClassMap: Record<WeatherMetricKey, string> = {
      high: styles.weatherMetricIconHigh,
      low: styles.weatherMetricIconLow,
      wind: styles.weatherMetricIconWind,
      rain: styles.weatherMetricIconRain,
      uv: styles.weatherMetricIconUv,
      precip: styles.weatherMetricIconPrecip
    };
    const leadLabel = current.observedAt ? "Agora" : dateLabel;
    const weeklyPreviewLabel = days.length > 1
      ? `${days.length} dias prontos para abrir`
      : "Semana pronta";
    const toggleWeekLabel = weatherWeekOpen ? "Ocultar semana" : "Abrir previsao da semana";
    const toggleWeatherWeek = () => {
      setWeatherWeekOpen((currentOpen) => {
        const nextOpen = !currentOpen;
        if (nextOpen && typeof window !== "undefined") {
          window.setTimeout(() => {
            weatherForecastRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 90);
        }
        return nextOpen;
      });
    };

    return (
      <section className={styles.weatherShell}>
        <article className={styles.weatherCurrentWidget}>
          <header className={styles.weatherCurrentHeader}>
            <div className={styles.weatherLocationRow}>
              <span className={styles.weatherLocationBadge}>Clima ao vivo</span>
              <div>
                <p className={styles.weatherLocationMeta}>{dateLabel}</p>
                <h3 className={styles.weatherLocationTitle}>{location}</h3>
                {liveCity && liveCity !== "Clima" ? (
                  <p className={styles.weatherLocationLive}>
                    {locationTypeLabel} acompanhado ao vivo: <strong>{liveCity}</strong>
                  </p>
                ) : null}
              </div>
            </div>
            <div className={styles.weatherHeaderMeta}>
              {updatedLabel ? <span className={styles.weatherUpdatedPill}>Atualizado {updatedLabel}</span> : null}
              {providerLabel ? <span className={styles.weatherProviderText}>Fonte {providerLabel}</span> : null}
            </div>
          </header>

          <div className={styles.weatherCurrentBody}>
            <div className={styles.weatherCurrentHero}>
              <div className={styles.weatherCurrentGlyphWrap}>
                <WeatherGlyph
                  weatherCode={current.weatherCode ?? data.weatherCode}
                  isDay={currentIsDay}
                  className={styles.weatherGlyphLg}
                />
              </div>
              <div className={styles.weatherCurrentPrimary}>
                <span className={styles.weatherCurrentLead}>{leadLabel}</span>
                <div className={styles.weatherCurrentTempRow}>
                  <strong className={styles.weatherCurrentTemp}>{currentTemperature}</strong>
                  {unitLabel ? <span className={styles.weatherCurrentUnit}>{unitLabel}</span> : null}
                </div>
                <p className={styles.weatherCurrentSummary}>{condition || "Sem atualizacao no momento."}</p>
              </div>
            </div>

            <div className={styles.weatherCurrentPanel}>
              <span className={styles.weatherStatusPill}>{condition || "Agora"}</span>
              <p className={styles.weatherCurrentNote}>{note || "Consulta pronta para leitura rapida e segura."}</p>
              {(locationSourceLabel || providerLabel) ? (
                <p className={styles.weatherTrustLine}>
                  {[locationSourceLabel, providerLabel ? `Fonte ${providerLabel}` : ""].filter(Boolean).join(" • ")}
                </p>
              ) : null}
            </div>
          </div>

          {weatherMetrics.length ? (
            <div className={styles.weatherMetricsGrid}>
              {weatherMetrics.map((item) => (
                <article key={`${message.id}-${item.key}`} className={styles.weatherMetricCard}>
                  <div className={styles.weatherMetricHead}>
                    <span className={[styles.weatherMetricIcon, weatherMetricToneClassMap[item.key]].filter(Boolean).join(" ")} aria-hidden="true">
                      <WeatherMetricGlyph metricKey={item.key} />
                    </span>
                    <span className={styles.weatherMetricLabel}>{item.label}</span>
                  </div>
                  <strong className={styles.weatherMetricValue}>{item.value}</strong>
                </article>
              ))}
            </div>
          ) : null}

          {days.length > 1 ? (
            <footer className={styles.weatherCurrentFooter}>
              <div className={styles.weatherCurrentFooterMeta}>
                <span className={styles.weatherCurrentFooterHint}>{weeklyPreviewLabel}</span>
                <span className={styles.weatherCurrentFooterText}>Mantive o clima do dia em destaque e deixei a semana em segundo nivel.</span>
              </div>
              <button type="button" className={styles.weatherCurrentLink} onClick={toggleWeatherWeek}>
                {toggleWeekLabel}
              </button>
            </footer>
          ) : null}
        </article>

        {days.length > 0 && weatherWeekOpen ? (
          <section ref={weatherForecastRef} className={styles.weatherWeeklySection}>
            <header className={styles.weatherWeeklyHeader}>
              <div>
                <h4 className={styles.weatherWeeklyTitle}>Previsao da semana</h4>
                <p className={styles.weatherWeeklyHint}>
                  {days.length > 1 ? `${days.length} dias confirmados para ${location}.` : weeklyHint}
                </p>
              </div>
            </header>
            <div className={styles.weatherWeeklyGrid}>
              {days.map((entry, index) => {
                const label = formatWeatherWeekLabel(entry, index);
                const dayNumber = formatWeatherDayNumber(entry, index);
                const dayHigh = formatWeatherDegree(entry.high ?? entry.temperature);
                const dayLow = formatWeatherDegree(entry.low);
                const dayCondition = cleanPlainText(String(entry.condition || ""));
                const dayRainChance = Number(entry.precipitationProbability);
                const dayRainLabel = Number.isFinite(dayRainChance) ? `Chuva ${Math.round(dayRainChance)}%` : "";
                const dayMeta = [dayCondition || "Sem resumo", dayRainLabel].filter(Boolean).join(" • ");
                const isActive = index === focusIndex;

                return (
                  <article
                    key={`${message.id}-weather-day-${index}`}
                    className={[
                      styles.weatherWeekCard,
                      isActive ? styles.weatherWeekCardActive : "",
                      index === 0 ? styles.weatherWeekCardToday : ""
                    ].filter(Boolean).join(" ")}
                  >
                    <div className={styles.weatherWeekCardHead}>
                      <strong className={styles.weatherWeekDayNumber}>{dayNumber}</strong>
                      <span className={styles.weatherWeekLabel}>{label}</span>
                    </div>
                    <WeatherGlyph
                      weatherCode={entry.weatherCode}
                      isDay={index === 0 ? currentIsDay : true}
                      className={styles.weatherGlyphSm}
                    />
                    <div className={styles.weatherWeekTemps}>
                      <strong className={styles.weatherWeekHi}>{dayHigh}</strong>
                      <span className={styles.weatherWeekLo}>{dayLow}</span>
                    </div>
                    <p className={styles.weatherWeekMeta}>{dayMeta}</p>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </section>
    );
  }

  if (variant === "fixture") {
    const teamName = cleanPlainText(String(data.teamName || ""));
    const league = cleanPlainText(String(data.league || data.competition || "Jogo"));
    const dateLabel = cleanPlainText(String(data.dateLabel || data.date || ""));
    const kickoff = cleanPlainText(String(data.kickoff || data.time || ""));
    const status = cleanPlainText(String(data.status || ""));
    const homeTeam = cleanPlainText(String(data.homeTeam || data.home || "Casa"));
    const awayTeam = cleanPlainText(String(data.awayTeam || data.away || "Visitante"));
    const homeScore = data.homeScore ?? data.scoreHome ?? null;
    const awayScore = data.awayScore ?? data.scoreAway ?? null;
    const note = cleanPlainText(String(data.note || data.venue || ""));
    const teamBadge = sanitizeRemoteImageUrl(data.teamBadge);
    const teamCountry = cleanPlainText(String(data.teamCountry || ""));
    const subjectType = cleanPlainText(String(data.subjectType || ""));
    const hasUpcomingFixture = data.hasUpcomingFixture !== false && Boolean(awayTeam);
    const sourceLinks = Array.isArray(data.sourceLinks)
      ? data.sourceLinks
          .map((entry) => (entry && typeof entry === "object" ? entry as Record<string, unknown> : null))
          .filter(Boolean) as Record<string, unknown>[]
      : [];
    const liveMatches = Array.isArray(data.liveMatches)
      ? data.liveMatches
          .map((entry) => (entry && typeof entry === "object" ? entry as Record<string, unknown> : null))
          .filter(Boolean) as Record<string, unknown>[]
      : [];
    const verification = data.verification && typeof data.verification === "object"
      ? data.verification as Record<string, unknown>
      : null;
    const nextMatches = Array.isArray(data.nextMatches)
      ? data.nextMatches
          .map((entry) => (entry && typeof entry === "object" ? entry as Record<string, unknown> : null))
          .filter(Boolean) as Record<string, unknown>[]
      : [];
    const recentMatches = Array.isArray(data.recentMatches)
      ? data.recentMatches
          .map((entry) => (entry && typeof entry === "object" ? entry as Record<string, unknown> : null))
          .filter(Boolean) as Record<string, unknown>[]
      : [];
    const fallbackUpcomingMatch: Record<string, unknown> | null = hasUpcomingFixture
      ? {
          homeTeam,
          awayTeam,
          homeScore,
          awayScore,
          kickoff,
          dateLabel,
          status,
          venue: data.venue,
          league
        }
      : null;
    const upcomingMatches = nextMatches.length > 0
      ? nextMatches
      : (fallbackUpcomingMatch ? [fallbackUpcomingMatch] : []);
    const safeFixtureIndex = upcomingMatches.length > 0
      ? Math.max(0, Math.min(activeFixtureIndex, upcomingMatches.length - 1))
      : 0;
    const selectedFixture = upcomingMatches[safeFixtureIndex] || null;
    const selectedHomeTeam = cleanPlainText(String(selectedFixture?.homeTeam || homeTeam || "Casa"));
    const selectedAwayTeam = cleanPlainText(String(selectedFixture?.awayTeam || awayTeam || "Visitante"));
    const selectedHomeScore = selectedFixture?.homeScore ?? selectedFixture?.scoreHome ?? homeScore ?? null;
    const selectedAwayScore = selectedFixture?.awayScore ?? selectedFixture?.scoreAway ?? awayScore ?? null;
    const selectedKickoff = cleanPlainText(String(selectedFixture?.kickoff || selectedFixture?.time || kickoff || "--:--"));
    const selectedDateLabel = cleanPlainText(String(selectedFixture?.dateLabel || selectedFixture?.date || dateLabel || "Em breve"));
    const selectedStatus = cleanPlainText(String(selectedFixture?.status || status || ""));
    const selectedVenue = cleanPlainText(String(selectedFixture?.venue || data.venue || ""));
    const selectedHomeBadge = sanitizeRemoteImageUrl(selectedFixture?.homeBadge ?? data.homeBadge);
    const selectedAwayBadge = sanitizeRemoteImageUrl(selectedFixture?.awayBadge ?? data.awayBadge);
    const selectedHasScore = selectedHomeScore != null && selectedAwayScore != null;
    const selectedHasUpcoming = Boolean(selectedFixture && selectedAwayTeam);
    const compactUnavailable = !selectedHasUpcoming && recentMatches.length === 0;
    const canNavigateFuture = upcomingMatches.length > 1;
    const primarySourceLink = sourceLinks[0] || null;
    const verificationLabel = cleanPlainText(String(verification?.label || ""));
    const verificationNote = cleanPlainText(String(verification?.note || ""));
    const verificationStatus = cleanPlainText(String(verification?.status || "")).toLowerCase();
    const teamEyebrow = [teamName || "agenda esportiva", subjectType === "national_team" ? "selecao" : subjectType === "club" ? "clube" : teamCountry]
      .filter(Boolean)
      .join(" • ");
    const footerLabel = primarySourceLink
      ? `Ver mais sobre ${league || teamName || "a partida"}`
      : canNavigateFuture
        ? "Ver jogos futuros"
        : note || `Acompanhar ${teamName || league || "agenda esportiva"}`;

    const buildBadgeLabel = (value: string) => {
      const parts = cleanPlainText(value)
        .split(/\s+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => !/^(de|da|do|das|dos|fc|ec|sc)$/i.test(part));

      const compact = parts.slice(0, 2).map((part) => part.charAt(0)).join("");
      return (compact || value.slice(0, 2) || "--").toUpperCase();
    };

    const renderFixtureTeamMark = (name: string, badgeUrl: string) => (
      <span className={`${styles.fixtureTeamMark} ${badgeUrl ? styles.fixtureTeamMarkImage : ""}`.trim()}>
        {badgeUrl ? (
          <Image
            src={badgeUrl}
            alt={`${name} escudo`}
            width={40}
            height={40}
            unoptimized
            className={styles.fixtureTeamBadge}
          />
        ) : (
          buildBadgeLabel(name)
        )}
      </span>
    );

    const normalizedTeamName = teamName
      ? teamName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      : "";

    const buildRecentResult = (match: Record<string, unknown>) => {
      const recentHome = cleanPlainText(String(match.homeTeam || "Casa"));
      const recentAway = cleanPlainText(String(match.awayTeam || "Visitante"));
      const recentHomeScore = match.homeScore ?? match.scoreHome ?? null;
      const recentAwayScore = match.awayScore ?? match.scoreAway ?? null;
      const normalizedHome = recentHome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const normalizedAway = recentAway.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const teamIsHome = normalizedTeamName && normalizedHome.includes(normalizedTeamName);
      const teamIsAway = normalizedTeamName && normalizedAway.includes(normalizedTeamName);
      const ownScore = teamIsHome ? recentHomeScore : teamIsAway ? recentAwayScore : recentHomeScore;
      const rivalScore = teamIsHome ? recentAwayScore : teamIsAway ? recentHomeScore : recentAwayScore;
      const rivalName = teamIsHome ? recentAway : teamIsAway ? recentHome : `${recentHome} x ${recentAway}`;
      const rivalBadge = sanitizeRemoteImageUrl(teamIsHome ? match.awayBadge : teamIsAway ? match.homeBadge : "");

      let resultPrefix = "J";
      if (typeof ownScore === "number" && typeof rivalScore === "number") {
        if (ownScore > rivalScore) resultPrefix = "V";
        else if (ownScore < rivalScore) resultPrefix = "D";
        else resultPrefix = "E";
      }

      return {
        label: `${resultPrefix} ${String(recentHomeScore ?? "-")} x ${String(recentAwayScore ?? "-")}`,
        rival: rivalName,
        date: cleanPlainText(String(match.dateLabel || match.date || "Recente")),
        rivalBadge
      };
    };

    return (
      <section className={styles.fixtureShell}>
        <article className={styles.fixtureWidget}>
          <div className={styles.fixtureWidgetHeader}>
            <div className={styles.fixtureLeagueCluster}>
              <span className={styles.fixtureLeagueDot} aria-hidden="true">
                {teamBadge ? (
                  <Image
                    src={teamBadge}
                    alt={`${teamName || "time"} escudo`}
                    width={24}
                    height={24}
                    unoptimized
                    className={styles.fixtureLeagueBadge}
                  />
                ) : (
                  "🏆"
                )}
              </span>
              <div className={styles.fixtureLeagueText}>
                <small className={styles.fixtureLeagueEyebrow}>{teamEyebrow || "agenda esportiva"}</small>
                <div className={styles.fixtureLeagueTitleRow}>
                  <h3 className={styles.fixtureLeagueTitle}>{league}</h3>
                  <span className={styles.fixtureLeagueCaret} aria-hidden="true">▾</span>
                </div>
              </div>
            </div>
            <div className={styles.fixtureWidgetMeta}>
              {status && <span className={styles.fixtureStatusBadge}>{status}</span>}
              {verificationLabel ? (
                <span
                  className={[
                    styles.fixtureVerificationBadge,
                    verificationStatus === "checked"
                      ? styles.fixtureVerificationBadgeChecked
                      : verificationStatus === "partial"
                        ? styles.fixtureVerificationBadgePartial
                        : styles.fixtureVerificationBadgeSafe
                  ].filter(Boolean).join(" ")}
                >
                  {verificationLabel}
                </span>
              ) : null}
              <div className={styles.fixtureWidgetActions}>
                {onCopy && (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.fixtureActionBtn} ${copied ? styles.fixtureActionBtnCopied : ""}`.trim()}
                    onClick={() => void handleCopy()}
                    aria-label={copied ? "Partida copiada" : "Copiar partida"}
                    title={copied ? "Partida copiada" : "Copiar partida"}
                  >
                    {copied ? <IconCheck /> : <IconCopy />}
                  </button>
                )}
                {onEdit && (
                  <button type="button" className={`${styles.actionBtn} ${styles.fixtureActionBtn}`.trim()} onClick={() => onEdit(serializedData)} aria-label="Editar partida" title="Editar partida">
                    <IconEdit />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className={`${styles.fixtureBoard} ${compactUnavailable ? styles.fixtureBoardUnavailable : ""}`.trim()}>
            {compactUnavailable ? (
              <>
                <div className={styles.fixtureCompetitor}>
                  {renderFixtureTeamMark(selectedHomeTeam || teamName || "Time", selectedHomeBadge || teamBadge)}
                  <strong className={styles.fixtureTeamName}>{selectedHomeTeam || teamName || "Agenda esportiva"}</strong>
                  <small className={styles.fixtureTeamRole}>consulta ao vivo</small>
                </div>
                <div className={styles.fixtureBoardCenter}>
                  <strong className={styles.fixtureUnavailablePrimary}>Sem agenda</strong>
                  <small className={styles.fixtureUnavailableSecondary}>Aguardando fonte confirmada</small>
                </div>
              </>
            ) : (
              <>
                <div className={styles.fixtureCompetitor}>
                  {renderFixtureTeamMark(selectedHomeTeam, selectedHomeBadge)}
                  <strong className={styles.fixtureTeamName}>{selectedHomeTeam}</strong>
                  <small className={styles.fixtureTeamRole}>mandante</small>
                </div>

                <div className={styles.fixtureBoardCenter}>
                  {!selectedHasScore ? <small className={styles.fixtureBoardVersus}>VS</small> : null}
                  <strong className={styles.fixtureBoardScore}>
                    {selectedHasScore
                      ? `${String(selectedHomeScore)} - ${String(selectedAwayScore)}`
                      : selectedHasUpcoming
                        ? (selectedKickoff || "--:--")
                        : "Sem agenda"}
                  </strong>
                  <small className={styles.fixtureBoardDate}>
                    {selectedHasUpcoming ? (selectedDateLabel || "Em breve") : "Sem confirmacao"}
                  </small>
                </div>

                <div className={styles.fixtureCompetitor}>
                  {renderFixtureTeamMark(selectedAwayTeam || "Em breve", selectedAwayBadge)}
                  <strong className={styles.fixtureTeamName}>{selectedAwayTeam || "Adversario indefinido"}</strong>
                  <small className={styles.fixtureTeamRole}>visitante</small>
                </div>
              </>
            )}
          </div>

          {selectedVenue ? <p className={styles.fixtureMetaLine}>{selectedVenue}</p> : null}
          {selectedStatus && !compactUnavailable ? <p className={styles.fixtureMetaLine}>{selectedStatus}</p> : null}
          {verificationNote ? <p className={styles.fixtureMetaLine}>{verificationNote}</p> : null}

          <div className={styles.fixtureFooterBar}>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.fixtureNavBtn}`.trim()}
              onClick={() => setActiveFixtureIndex((current) => (current - 1 + upcomingMatches.length) % upcomingMatches.length)}
              disabled={!canNavigateFuture}
              aria-label="Ver jogo anterior"
              title="Ver jogo anterior"
            >
              <IconChevronLeft />
            </button>
            {primarySourceLink ? (
              <a
                className={styles.fixtureFooterLink}
                href={String(primarySourceLink.link || "#")}
                target="_blank"
                rel="noreferrer"
              >
                {footerLabel}
              </a>
            ) : (
              <p className={styles.fixtureFooterNote}>{footerLabel}</p>
            )}
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.fixtureNavBtn}`.trim()}
              onClick={() => setActiveFixtureIndex((current) => (current + 1) % upcomingMatches.length)}
              disabled={!canNavigateFuture}
              aria-label="Ver proximo jogo"
              title="Ver proximo jogo"
            >
              <IconChevronRight />
            </button>
          </div>

          {canNavigateFuture ? (
            <div className={styles.fixturePager}>
              <span>{safeFixtureIndex + 1} de {upcomingMatches.length}</span>
              <span>Jogos futuros</span>
            </div>
          ) : null}

          {liveMatches.length > 0 ? (
            <p className={styles.fixtureSectionLabel}>Jogo em andamento</p>
          ) : null}

          {recentMatches.length > 0 && (
            <>
              <p className={styles.fixtureSectionLabel}>Ultimos 5 jogos</p>
              <div className={styles.fixtureRecentStrip}>
              {recentMatches.slice(0, 5).map((match, index) => {
                const recent = buildRecentResult(match);
                return (
                  <article key={`${message.id}-fixture-recent-${index}`} className={styles.fixtureRecentCard}>
                    <div className={styles.fixtureRecentCardHead}>
                      <small>{recent.date}</small>
                      {recent.rivalBadge ? (
                        <span className={styles.fixtureRecentBadge}>
                          <Image
                            src={recent.rivalBadge}
                            alt={`${recent.rival} escudo`}
                            width={20}
                            height={20}
                            unoptimized
                            className={styles.fixtureRecentBadgeImage}
                          />
                        </span>
                      ) : null}
                    </div>
                    <strong className={styles.fixtureRecentResult}>{recent.label}</strong>
                    <span className={styles.fixtureRecentOpponent}>{recent.rival}</span>
                  </article>
                );
              })}
              </div>
            </>
          )}

          {sourceLinks.length > 0 && (
            <div className={styles.fixtureLinks}>
              {sourceLinks.slice(0, 2).map((entry, index) => (
                <a
                  key={`${message.id}-fixture-link-${index}`}
                  className={styles.fixtureLink}
                  href={String(entry.link || "#")}
                  target="_blank"
                  rel="noreferrer"
                >
                  {cleanPlainText(String(entry.source || entry.title || "Ver fonte"))}
                </a>
              ))}
            </div>
          )}
        </article>
      </section>
    );
  }

  return (
    <BlockFrame
      title="Dados"
      icon={<IconData />}
      onCopy={onCopy ? () => onCopy(serializedData) : undefined}
      onEdit={onEdit ? () => onEdit(serializedData) : undefined}
      onPreview={() => setPreviewOpen((current) => !current)}
    >
      <div className={styles.dataGrid}>
        {Object.entries(data).map(([key, value]) => (
          <article key={`${message.id}-${key}`} className={styles.dataItem}>
            <small className={styles.dataLabel}>{key}</small>
            <strong className={styles.dataValue}>{cleanPlainText(String(value))}</strong>
          </article>
        ))}
      </div>
      {previewOpen && <p className={styles.previewNote}>Preview ativo: painel de dados com leitura rapida.</p>}
    </BlockFrame>
  );
}

export function MessageRenderer({ message, onCopy, onEdit }: MessageRendererProps) {
  return (
    <div className={styles.renderer}>
      {message.type === "code" && <CodeBlock message={message} onCopy={onCopy} onEdit={onEdit} />}
      {message.type === "document" && <DocumentBlock message={message} onCopy={onCopy} onEdit={onEdit} />}
      {message.type === "prompt" && <PromptBlock message={message} onCopy={onCopy} onEdit={onEdit} />}
      {message.type === "checklist" && <ChecklistBlock message={message} onCopy={onCopy} onEdit={onEdit} />}
      {message.type === "table" && <TableBlock message={message} onCopy={onCopy} onEdit={onEdit} />}
      {message.type === "timeline" && <TimelineBlock message={message} onCopy={onCopy} onEdit={onEdit} />}
      {message.type === "image" && <ImageBlock message={message} onCopy={onCopy} onEdit={onEdit} />}
      {message.type === "video" && <VideoBlock message={message} onCopy={onCopy} onEdit={onEdit} />}
      {message.type === "map" && <MapBlock message={message} onCopy={onCopy} onEdit={onEdit} />}
      {message.type === "data" && <DataBlock message={message} onCopy={onCopy} onEdit={onEdit} />}
      {message.type === "text" && <TextMessage message={message} onCopy={onCopy} onEdit={onEdit} />}
    </div>
  );
}
