import { Landmark, Wrench } from 'lucide-react'
import { INFO_RESOURCES } from '../../lib/info/resources'
import { ResourceGrid } from './InfoBlocks'
import { InfoSection, PageIntro } from './infoUi'

export default function ToolsPage({ isAuthenticated }: { isAuthenticated: boolean }) {
  const ujServices = INFO_RESOURCES.filter((r) => r.external)
  const ujverseTools = INFO_RESOURCES.filter((r) => !r.external)
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageIntro
        title="Niezbędnik studenta"
        description="Najważniejsze serwisy UJ i narzędzia UJverse w jednym miejscu."
      />
      <InfoSection icon={Landmark} title="Serwisy UJ" subtitle="Linki do oficjalnych serwisów uczelni (otwierają się w nowej karcie).">
        <ResourceGrid resources={ujServices} isAuthenticated={isAuthenticated} columns="sm:grid-cols-2 lg:grid-cols-3" />
      </InfoSection>
      <InfoSection
        icon={Wrench}
        title="Narzędzia UJverse"
        subtitle={
          isAuthenticated
            ? 'Narzędzia związane z Twoim kontem są oznaczone w opisie.'
            : 'Część narzędzi przechowuje Twoje dane (np. plan zajęć), dlatego wymaga konta. Resztę możesz używać od razu.'
        }
      >
        <ResourceGrid resources={ujverseTools} isAuthenticated={isAuthenticated} columns="sm:grid-cols-2 lg:grid-cols-3" />
      </InfoSection>
      <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
        UJverse to niezależny projekt studencki — nie jest oficjalnym serwisem Uniwersytetu Jagiellońskiego i nie jest
        powiązany z linkowanymi serwisami.
      </p>
    </div>
  )
}
