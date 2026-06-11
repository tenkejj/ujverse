import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Calendar,
  Clock,
  GraduationCap,
  Loader2,
  MapPin,
  MessageSquareText,
  Paperclip,
  Search,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import ChannelKindPill, { CHANNEL_KINDS } from './aula/ChannelKindPill'
import type { ChannelKind } from '../types/database'

/**
 * Defensywne mapowanie raw `channelKind` z search hita na `ChannelKind`.
 * Legacy dokumenty bez `channelKind` lub z nieznaną wartością → `inne`.
 */
function asOmniChannelKind(raw: string | null | undefined): ChannelKind {
  if (typeof raw === 'string' && (CHANNEL_KINDS as readonly string[]).includes(raw)) {
    return raw as ChannelKind
  }
  return 'inne'
}
import { useOmniSearch, type OmniSearchHandlers } from '../hooks/useOmniSearch'
import { ACADEMIC_HINTS } from '../lib/searchHints'
import { OMNI_DESKTOP as T } from '../styles/mobile-theme'
import { getDeptAbbreviation } from '../lib/departments'
import UserAvatar from './UserAvatar'
import type { Profile } from '../types'
import type { EventMeta, UnifiedContent } from '../types/content'
import type { AulaSearchHit, SearchHit, SearchUserHit } from '../types/search'

/**
 * OmniSearchHub v2 — desktopowa paleta wyszukiwania (md:+).
 *
 * Zawiera 6 zintegrowanych systemów (patrz `useOmniSearch`):
 *  1. Dynamiczny dropdown 'search-as-you-type' (debounce 180 ms, limit 5/sekcja)
 *  2. Globalna paleta Ctrl/Cmd+K + nawigacja klawiszowa
 *  3. Smart hints (fallback "Może szukasz?")
 *  4. Recent searches (max 3 z localStorage)
 *  5. Slash-komendy `/p`, `/k`, `/ciemny`, `/jasny`
 *  6. AbortController + cache 120 s
 *
 * Mobile (<768 px) korzysta dalej z full-screen `SearchBar.tsx`.
 */
type Props = OmniSearchHandlers & {
  /** Cohort zalogowanego usera — bez tego sekcja "Aula" jest wyłączona. */
  cohortId?: string | null
}

function searchUserHitToProfile(hit: SearchUserHit): Profile {
  return {
    id: hit.id,
    full_name: hit.fullName ?? hit.username ?? 'Użytkownik',
    username: hit.username,
    avatar_url: hit.avatarUrl,
    department: hit.department,
  }
}

function stripMarks(value: string): string {
  return value.replaceAll('<mark>', '').replaceAll('</mark>', '')
}

export default function OmniSearchHub(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const o = useOmniSearch({ inputRef, cohortId: props.cohortId, ...props })

  useEffect(() => {
    if (!o.isOpen) return
    const onPointer = (event: PointerEvent) => {
      if (!containerRef.current) return
      if (containerRef.current.contains(event.target as Node)) return
      o.close()
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [o])

  const showRecent = o.isOpen && o.query.length === 0 && o.history.length > 0
  const showEmptyRecent = o.isOpen && o.query.length === 0 && o.history.length === 0
  const showShortHint = o.isOpen && o.query.length > 0 && o.parsed.stripped.trim().length < 2
  const showResults = o.isOpen && o.parsed.stripped.trim().length >= 2 && !o.isLoading && o.hasResults
  const showSmartHints = o.isOpen && o.searched && !o.hasResults
  const showLoading = o.isOpen && o.isLoading
  const showErrorRow = o.isOpen && !!o.error && !o.isLoading

  const profilesOffset = 0
  const postsOffset = o.results.profiles.length
  const announcementsOffset = postsOffset + o.results.posts.length
  const eventsOffset = announcementsOffset + o.results.announcements.length
  const aulaOffset = eventsOffset + o.results.events.length

  return (
    <div ref={containerRef} className="relative hidden md:flex">
      <div className={T.inputCapsuleWrap}>
        <Search strokeWidth={2} className={T.inputLeadingIcon} aria-hidden />
        {o.parsed.mode !== 'all' && (
          <span className={T.modeBadge} aria-label={`Tryb: ${o.parsed.mode}`}>
            {o.parsed.mode === 'profiles' ? '/p' : '/k'}
          </span>
        )}
        <input
          ref={inputRef}
          type="search"
          name="ujverse-omni-search"
          value={o.query}
          onChange={(event) => o.setQuery(event.target.value)}
          onFocus={o.open}
          onKeyDown={o.onKeyDown}
          placeholder="Szukaj w UJverse…"
          className={`ujverse-search-input ${T.inputInner}`}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={o.isOpen}
          aria-controls="omni-dropdown-panel"
          aria-autocomplete="list"
          aria-activedescendant={
            o.activeIndex >= 0 ? `omni-row-${o.activeIndex}` : undefined
          }
        />
        {o.query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              o.setQuery('')
              inputRef.current?.focus({ preventScroll: true })
            }}
            className="shrink-0 p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-white/5 transition-all"
            title="Wyczyść tekst"
            aria-label="Wyczyść tekst"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            const trimmed = o.query.trim()
            if (trimmed.length >= 2) {
              o.submitFullSearch()
              return
            }
            o.close()
            props.onNavigateToSearch()
          }}
          className="shrink-0 p-1 rounded-md text-[#1e293b]/70 hover:text-[#1e293b] hover:bg-zinc-100 dark:text-brand-gold-bright/70 dark:hover:text-brand-gold-bright dark:hover:bg-white/5 transition-all"
          title="Otwórz pełną wyszukiwarkę"
          aria-label="Otwórz pełną wyszukiwarkę"
        >
          <SlidersHorizontal size={13} strokeWidth={2.25} />
        </button>
      </div>

      <AnimatePresence>
        {o.isOpen && (
          <motion.div
            id="omni-dropdown-panel"
            role="listbox"
            aria-label="Wyniki wyszukiwania"
            className={T.panel}
            initial={T.motion.panel.initial}
            animate={T.motion.panel.animate}
            exit={T.motion.panel.exit}
            transition={T.motion.panel.transition}
          >
            <div className={T.panelInner}>
              {showRecent && (
                <RecentSection
                  items={o.history}
                  onPick={(entry) => o.applyQuery(entry)}
                  onRemove={(entry) => o.removeHistoryItem(entry)}
                  onClearAll={o.clearHistory}
                />
              )}

              {showEmptyRecent && (
                <div className={T.emptyMessage}>
                  Zacznij pisać aby wyszukać posty, komunikaty, wydarzenia i profile.
                </div>
              )}

              {showShortHint && (
                <div className={T.emptyMessage}>Wpisz co najmniej 2 znaki…</div>
              )}

              {showLoading && (
                <div className={T.loadingRow} role="status" aria-live="polite">
                  <Loader2 size={14} className="animate-spin text-[#1e293b] dark:text-brand-gold-bright" />
                  Szukam…
                </div>
              )}

              {showErrorRow && (
                <div className={T.emptyMessage} role="alert">
                  {o.error}
                </div>
              )}

              {showResults && (
                <motion.div
                  variants={T.motion.staggerContainer}
                  initial="hidden"
                  animate="show"
                >
                  {o.results.profiles.length > 0 && (
                    <ProfilesSection
                      items={o.results.profiles}
                      activeIndex={o.activeIndex}
                      indexOffset={profilesOffset}
                      onPick={(profileId) => {
                        o.close()
                        props.onNavigateToUser(profileId)
                      }}
                      registerRow={o.registerRow}
                    />
                  )}
                  {o.results.posts.length > 0 && (
                    <PostsSection
                      items={o.results.posts}
                      activeIndex={o.activeIndex}
                      indexOffset={postsOffset}
                      onPick={(postId) => {
                        o.close()
                        props.onNavigateToPost(postId)
                      }}
                      registerRow={o.registerRow}
                    />
                  )}
                  {o.results.announcements.length > 0 && (
                    <AnnouncementsSection
                      items={o.results.announcements}
                      activeIndex={o.activeIndex}
                      indexOffset={announcementsOffset}
                      onPick={() => {
                        o.close()
                        props.onNavigateToEvents()
                      }}
                      registerRow={o.registerRow}
                    />
                  )}
                  {o.results.events.length > 0 && (
                    <EventsSection
                      items={o.results.events}
                      activeIndex={o.activeIndex}
                      indexOffset={eventsOffset}
                      onPick={(eventId) => {
                        o.close()
                        props.onNavigateToEvents(eventId)
                      }}
                      registerRow={o.registerRow}
                    />
                  )}
                  {o.results.aula.length > 0 && (
                    <AulaSection
                      items={o.results.aula}
                      activeIndex={o.activeIndex}
                      indexOffset={aulaOffset}
                      onPick={(messageId) => {
                        o.close()
                        props.onNavigateToAulaMessage?.(Number(messageId))
                      }}
                      registerRow={o.registerRow}
                    />
                  )}
                </motion.div>
              )}

              {showSmartHints && (
                <SmartHintsSection query={o.parsed.stripped} onPick={(q) => o.applyQuery(q)} />
              )}
            </div>

            {o.isOpen && o.query.trim().length >= 2 && (
              <DropdownFooter
                count={o.totalCount}
                onSubmit={() => o.submitFullSearch()}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

type SectionProps<T> = {
  items: T[]
  activeIndex: number
  indexOffset: number
  onPick: (id: string) => void
  registerRow: (index: number, node: HTMLElement | null) => void
}

function rowClassFor(active: boolean): string {
  return `${T.rowBase} ${T.rowHover}${active ? ` ${T.rowActive}` : ''}`
}

function ProfilesSection({
  items,
  activeIndex,
  indexOffset,
  onPick,
  registerRow,
}: SectionProps<SearchUserHit>) {
  return (
    <section aria-label="Profile">
      <div className={T.sectionHeader}>
        <UserRound size={12} strokeWidth={2.25} className={T.sectionIcon} aria-hidden />
        Profile
      </div>
      <ul className={T.sectionBody} role="presentation">
        {items.map((hit, i) => {
          const idx = indexOffset + i
          const active = activeIndex === idx
          const profile = searchUserHitToProfile(hit)
          return (
            <li key={hit.id} role="presentation">
              <button
                ref={(node) => registerRow(idx, node)}
                id={`omni-row-${idx}`}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onPick(hit.id)}
                className={rowClassFor(active)}
              >
                <UserAvatar profile={profile} name={profile.full_name ?? 'U'} className={T.rowAvatar} textSize="text-xs" />
                <span className="flex-1 min-w-0">
                  <span className={T.rowTitle}>{profile.full_name}</span>
                  {profile.department && (
                    <span className={T.rowMeta}>{getDeptAbbreviation(profile.department)}</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className={T.sectionDivider} aria-hidden />
    </section>
  )
}

function PostsSection({
  items,
  activeIndex,
  indexOffset,
  onPick,
  registerRow,
}: SectionProps<SearchHit>) {
  return (
    <section aria-label="Posty">
      <div className={T.sectionHeader}>
        <MessageSquareText size={12} strokeWidth={2.25} className={T.sectionIcon} aria-hidden />
        Posty
      </div>
      <ul className={T.sectionBody} role="presentation">
        {items.map((hit, i) => {
          const idx = indexOffset + i
          const active = activeIndex === idx
          const snippet = stripMarks(hit._formatted?.content ?? hit.content)
          const author = stripMarks(hit._formatted?.author ?? hit.author)
          return (
            <li key={hit.id} role="presentation">
              <button
                ref={(node) => registerRow(idx, node)}
                id={`omni-row-${idx}`}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onPick(hit.sourceId)}
                className={rowClassFor(active)}
              >
                <span className={T.rowIconBubble} aria-hidden>
                  <MessageSquareText size={14} strokeWidth={2} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className={T.rowTitle}>{author || 'Użytkownik'}</span>
                  <span className={T.rowSnippet}>{snippet}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className={T.sectionDivider} aria-hidden />
    </section>
  )
}

function EventsSection({
  items,
  activeIndex,
  indexOffset,
  onPick,
  registerRow,
}: SectionProps<UnifiedContent<EventMeta>>) {
  return (
    <section aria-label="Wydarzenia">
      <div className={T.sectionHeader}>
        <Calendar size={12} strokeWidth={2.25} className={T.sectionIcon} aria-hidden />
        Wydarzenia
      </div>
      <ul className={T.sectionBody} role="presentation">
        {items.map((event, i) => {
          const idx = indexOffset + i
          const active = activeIndex === idx
          const location = event.metadata.location?.trim()
          return (
            <li key={event.id} role="presentation">
              <button
                ref={(node) => registerRow(idx, node)}
                id={`omni-row-${idx}`}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onPick(event.id)}
                className={rowClassFor(active)}
              >
                <span className={T.rowIconBubble} aria-hidden>
                  <Calendar size={14} strokeWidth={2} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className={T.rowTitle}>{event.title}</span>
                  <span className={T.rowSnippet}>
                    {location || event.metadata.category || 'Wydarzenie'}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function AnnouncementsSection({
  items,
  activeIndex,
  indexOffset,
  onPick,
  registerRow,
}: SectionProps<SearchHit>) {
  return (
    <section aria-label="Komunikaty">
      <div className={T.sectionHeader}>
        <MapPin size={12} strokeWidth={2.25} className={T.sectionIcon} aria-hidden />
        Komunikaty
      </div>
      <ul className={T.sectionBody} role="presentation">
        {items.map((hit, i) => {
          const idx = indexOffset + i
          const active = activeIndex === idx
          const snippet = stripMarks(hit._formatted?.content ?? hit.content)
          const author = stripMarks(hit._formatted?.author ?? hit.author)
          return (
            <li key={hit.id} role="presentation">
              <button
                ref={(node) => registerRow(idx, node)}
                id={`omni-row-${idx}`}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onPick(hit.sourceId)}
                className={rowClassFor(active)}
              >
                <span className={T.rowIconBubble} aria-hidden>
                  <MapPin size={14} strokeWidth={2} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className={T.rowTitle}>{author || 'Komunikat'}</span>
                  <span className={T.rowSnippet}>{snippet}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function AulaSection({
  items,
  activeIndex,
  indexOffset,
  onPick,
  registerRow,
}: SectionProps<AulaSearchHit>) {
  return (
    <section aria-label="Aula">
      <div className={T.sectionHeader}>
        <GraduationCap size={12} strokeWidth={2.25} className={T.sectionIcon} aria-hidden />
        Aula
      </div>
      <ul className={T.sectionBody} role="presentation">
        {items.map((hit, i) => {
          const idx = indexOffset + i
          const active = activeIndex === idx
          const snippet = stripMarks(hit.contentSnippetHTML ?? hit.content)
          const author = hit.authorName || 'Użytkownik'
          return (
            <li key={hit.id} role="presentation">
              <button
                ref={(node) => registerRow(idx, node)}
                id={`omni-row-${idx}`}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onPick(String(hit.messageId))}
                className={rowClassFor(active)}
              >
                <span className={T.rowIconBubble} aria-hidden>
                  <GraduationCap size={14} strokeWidth={2} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className={T.rowTitle}>
                    {author}
                    {hit.channelId == null ? (
                      <span
                        className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-[#1e293b]/[0.06] px-1.5 py-0.5 align-baseline text-[10px] font-semibold text-[#1e293b] dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright"
                        title="Sala główna"
                      >
                        <GraduationCap size={9} />
                        Sala główna
                      </span>
                    ) : (
                      <span
                        className="ml-1.5 inline-flex items-center gap-1 align-baseline"
                        title={`Sala: ${hit.channelName ?? hit.channelSlug ?? ''}`}
                      >
                        <ChannelKindPill kind={asOmniChannelKind(hit.channelKind)} size="sm" />
                        <span className="text-[10px] font-semibold text-fg-primary">
                          {hit.channelName ?? hit.channelSlug}
                        </span>
                      </span>
                    )}
                  </span>
                  <span className={T.rowSnippet}>{snippet || (hit.hasAttachments ? 'Załącznik' : '')}</span>
                </span>
                {hit.hasAttachments && (
                  <span
                    className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-300/70 bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-600 dark:border-white/15 dark:bg-black/30 dark:text-zinc-300"
                    title={`${hit.fileNames.length} ${hit.fileNames.length === 1 ? 'plik' : 'plików'}`}
                  >
                    <Paperclip size={10} strokeWidth={2.25} />
                    {hit.fileNames.length}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <div className={T.sectionDivider} aria-hidden />
    </section>
  )
}

function RecentSection({
  items,
  onPick,
  onRemove,
  onClearAll,
}: {
  items: string[]
  onPick: (entry: string) => void
  onRemove: (entry: string) => void
  onClearAll: () => void
}) {
  return (
    <section aria-label="Ostatnio wyszukiwane">
      <div className="flex items-center justify-between pr-3">
        <div className={T.sectionHeader}>
          <Clock size={12} strokeWidth={2.25} className={T.sectionIcon} aria-hidden />
          Ostatnio wyszukiwane
        </div>
        <button
          type="button"
          onClick={onClearAll}
          className="mr-1 mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-[#1e293b] dark:hover:text-brand-gold-bright"
        >
          Wyczyść
        </button>
      </div>
      <ul className={T.sectionBody} role="presentation">
        {items.map((entry) => (
          <li key={entry} role="presentation" className={T.recentRow}>
            <Clock size={14} strokeWidth={2} className={T.recentClock} aria-hidden />
            <button
              type="button"
              onClick={() => onPick(entry)}
              className={T.recentText}
            >
              {entry}
            </button>
            <button
              type="button"
              onClick={() => onRemove(entry)}
              className={`${T.recentRemove} group/remove`}
              aria-label={`Usuń „${entry}” z historii`}
            >
              <X
                size={14}
                strokeWidth={2}
                aria-hidden
                className="pointer-events-none shrink-0 text-zinc-400 transition-colors group-hover/remove:text-zinc-600 dark:text-zinc-500 dark:group-hover/remove:text-zinc-200"
              />
            </button>
          </li>
        ))}
      </ul>
      <div className={T.sectionDivider} aria-hidden />
    </section>
  )
}

function SmartHintsSection({
  query,
  onPick,
}: {
  query: string
  onPick: (q: string) => void
}) {
  return (
    <section aria-label="Sugerowane frazy">
      <div className={T.hintsHeader}>
        <Sparkles size={12} strokeWidth={2.25} className={T.sectionIcon} aria-hidden />
        Może szukasz?
      </div>
      <div className="px-4 pb-1 text-[12px] text-slate-500 dark:text-slate-400">
        Brak wyników dla <span className="font-semibold text-zinc-700 dark:text-zinc-200">"{query}"</span>.
      </div>
      <div className={T.hintsWrap}>
        {ACADEMIC_HINTS.map((hint) => {
          const Icon = hint.icon
          return (
            <button
              key={hint.id}
              type="button"
              onClick={() => onPick(hint.query)}
              className={T.hintChip}
            >
              <Icon size={13} strokeWidth={2} className={T.hintIcon} aria-hidden />
              {hint.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function DropdownFooter({ count, onSubmit }: { count: number; onSubmit: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSubmit}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSubmit()
        }
      }}
      className={`${T.footer} w-full`}
    >
      {count > 0 ? (
        <span className={T.footerLabel}>Zobacz wszystkie wyniki ({count})</span>
      ) : (
        <span className={T.footerLabel}>Wpisz komendy /p, /k, /ciemny...</span>
      )}
    </div>
  )
}
