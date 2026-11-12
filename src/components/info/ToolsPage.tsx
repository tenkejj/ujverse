import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlarmClock,
  BookOpen,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  Library,
  Mail,
  Sparkles,
  Tag,
  type LucideIcon,
} from 'lucide-react'
import { INFO_RESOURCES, type InfoResourceIcon } from '../../lib/info/resources'
import { ResourceHubCard } from './InfoHubCards'
import {
  InfoHubCardGrid,
  InfoHubSection,
  InfoHubShell,
  InfoHubTitle,
  InfoHubToolbar,
} from './InfoHubShell'

const ICONS: Record<InfoResourceIcon, LucideIcon> = {
  usos: GraduationCap,
  pegaz: BookOpen,
  mail: Mail,
  registrations: AlarmClock,
  calendar: CalendarDays,
  rooms: DoorOpen,
  plan: ClipboardList,
  spots: Library,
  discounts: Tag,
  assistant: Sparkles,
}

const TOOL_RESOURCES = INFO_RESOURCES.filter((resource) => !resource.id.startsWith('guide-'))

type Scope = 'all' | 'uj' | 'ujverse'

export default function ToolsPage({
  isAuthenticated,
}: {
  isAuthenticated: boolean
}) {
  const [scope, setScope] = useState<Scope>('all')
  const [text, setText] = useState('')

  const ujCount = TOOL_RESOURCES.filter((r) => r.external).length
  const appCount = TOOL_RESOURCES.filter((r) => !r.external).length

  const filters = [
    { key: 'all', label: 'Wszystkie', count: TOOL_RESOURCES.length },
    { key: 'uj', label: 'Serwisy UJ', count: ujCount },
    { key: 'ujverse', label: 'UJverse', count: appCount },
  ]

  const visible = useMemo(() => {
    const q = text.trim().toLowerCase()
    return TOOL_RESOURCES.filter((r) => {
      if (scope === 'uj' && !r.external) return false
      if (scope === 'ujverse' && r.external) return false
      if (!q) return true
      return (
        r.label.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.keywords.some((k) => k.includes(q))
      )
    })
  }, [scope, text])

  const ujVisible = visible.filter((r) => r.external)
  const appVisible = visible.filter((r) => !r.external)

  return (
    <InfoHubShell>
      <InfoHubTitle
        title="Niezbędnik studenta"
        description="Najważniejsze serwisy UJ i narzędzia UJverse w jednym miejscu."
      />
      <p className="campus-guide-intro">
        Potrzebujesz instrukcji?{' '}
        <Link to="/poradniki">
          Zobacz poradniki do spraw studenckich
        </Link>
        .
      </p>

      <InfoHubToolbar
        filters={filters}
        activeKey={scope}
        onFilterChange={(k) => setScope(k as Scope)}
        search={text}
        onSearchChange={setText}
        searchPlaceholder="Szukaj narzędzia…"
        searchAriaLabel="Szukaj w niezbędniku"
      />

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Brak narzędzi pasujących do wyszukiwania.
        </p>
      ) : (
        <>
          {ujVisible.length > 0 ? (
            <InfoHubSection title="Serwisy UJ" count={ujVisible.length}>
              <InfoHubCardGrid>
                {ujVisible.map((resource) => (
                  <li key={resource.id} className="min-w-0">
                    <ResourceHubCard
                      resource={resource}
                      isAuthenticated={isAuthenticated}
                      icon={ICONS[resource.icon]}
                    />
                  </li>
                ))}
              </InfoHubCardGrid>
            </InfoHubSection>
          ) : null}

          {appVisible.length > 0 ? (
            <InfoHubSection title="Narzędzia UJverse" count={appVisible.length}>
              <InfoHubCardGrid>
                {appVisible.map((resource) => (
                  <li key={resource.id} className="min-w-0">
                    <ResourceHubCard
                      resource={resource}
                      isAuthenticated={isAuthenticated}
                      icon={ICONS[resource.icon]}
                    />
                  </li>
                ))}
              </InfoHubCardGrid>
            </InfoHubSection>
          ) : null}
        </>
      )}

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        UJverse to niezależny projekt studencki — nie jest oficjalnym serwisem
        Uniwersytetu Jagiellońskiego.
      </p>
    </InfoHubShell>
  )
}
