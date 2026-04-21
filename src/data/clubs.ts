export type ClubTagTone = 'gold' | 'green' | 'red'

export type Club = {
  id: string
  name: string
  department: string
  tag: string
  tone: ClubTagTone
}

export type ClubsState = {
  items: Club[]
  loading: boolean
  error: string | null
}

export const CLUBS_SOURCE_URL = 'https://wzks.uj.edu.pl/studenci/kola-naukowe'

export const CLUBS: Club[] = [
  { id: 'strateg', name: 'Koło Naukowe Strateg', department: 'WZiKS', tag: '#marketing', tone: 'gold' },
  {
    id: 'kn-mediow',
    name: 'Koło Naukowe Mediów',
    department: 'WZiKS',
    tag: '#media',
    tone: 'green',
  },
  {
    id: 'kn-kreatywnego-brandingu',
    name: 'KN Kreatywnego Brandingu',
    department: 'WZiKS',
    tag: '#branding',
    tone: 'gold',
  },
  {
    id: 'kn-psychologii-stosowanej',
    name: 'KN Psychologii Stosowanej',
    department: 'WZiKS',
    tag: '#psychologia',
    tone: 'red',
  },
  {
    id: 'kn-analityki-mediow',
    name: 'KN Analityki Mediów Cyfrowych',
    department: 'WZiKS',
    tag: '#it',
    tone: 'green',
  },
  {
    id: 'kn-komunikacji-wizerunkowej',
    name: 'KN Komunikacji Wizerunkowej',
    department: 'WZiKS',
    tag: '#pr',
    tone: 'gold',
  },
  {
    id: 'kn-badan-kultury-internetu',
    name: 'KN Badań Kultury Internetu',
    department: 'WZiKS',
    tag: '#research',
    tone: 'red',
  },
  {
    id: 'kn-produkcji-audiowizualnej',
    name: 'KN Produkcji Audiowizualnej',
    department: 'WZiKS',
    tag: '#video',
    tone: 'green',
  },
  {
    id: 'kn-innowacji-marketingowych',
    name: 'KN Innowacji Marketingowych',
    department: 'WZiKS',
    tag: '#growth',
    tone: 'gold',
  },
]
