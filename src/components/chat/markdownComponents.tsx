/**
 * Wspólne mapowanie `react-markdown` → komponenty Tailwind dla całego
 * UI asystenta AI. UJverse nie używa `@tailwindcss/typography`, więc
 * każdy element (p / ul / h1 / a / code / pre / table) jest stylizowany
 * ręcznie pod ton wiadomości w bąbelku.
 *
 * Single source of truth — używane przez `MessageList.MessageBubble`
 * (historyczne wiadomości) oraz `TypewriterMarkdown` (live streaming).
 */

import type { Components } from 'react-markdown'

export const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="my-1 wrap-break-word">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-1 list-disc space-y-0.5 pl-4">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1 list-decimal space-y-0.5 pl-4">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  h1: ({ children }) => (
    <h3 className="mt-1.5 mb-1 text-sm font-semibold">{children}</h3>
  ),
  h2: ({ children }) => (
    <h4 className="mt-1.5 mb-1 text-xs font-semibold">{children}</h4>
  ),
  h3: ({ children }) => (
    <h5 className="mt-1.5 mb-1 text-xs font-semibold">{children}</h5>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#1e293b] underline underline-offset-2 hover:opacity-80 dark:text-brand-gold-bright"
    >
      {children}
    </a>
  ),
  code: ({ children, className }) => {
    const isInline = !className
    if (isInline) {
      return (
        <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.8em] dark:bg-white/10">
          {children}
        </code>
      )
    }
    return <code className={`${className ?? ''} font-mono`}>{children}</code>
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-zinc-950/85 p-2.5 text-[11px] text-zinc-100">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-1 border-l-2 border-zinc-300 pl-2.5 italic text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-zinc-300 px-1.5 py-1 text-left font-semibold dark:border-zinc-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-zinc-300 px-1.5 py-1 dark:border-zinc-700">
      {children}
    </td>
  ),
}
