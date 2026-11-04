/** Treści dla widoków wymagających konta — pokazywane zamiast pełnoekranowego logowania. */
export type ProtectedFeatureCopy = {
  feature: string
  reason: string
  alternative?: { label: string; to: string }
}

export const PROTECTED_FEATURES: Record<string, ProtectedFeatureCopy> = {
  feed: {
    feature: 'Społeczność',
    reason: 'Wpisy, komentarze i polubienia widzą tylko zalogowani studenci.',
    alternative: { label: 'Zobacz komunikaty wydziałów', to: '/komunikaty' },
  },
  post: {
    feature: 'Wpis społeczności',
    reason: 'Wpisy i komentarze widzą tylko zalogowani studenci.',
  },
  group: {
    feature: 'Strefy i grupy',
    reason: 'Strefy zbierają wpisy społeczności, dlatego wymagają zalogowania.',
  },
  profile: {
    feature: 'Twój profil',
    reason: 'Profil jest przypisany do Twojego konta.',
  },
  userProfile: {
    feature: 'Profil studenta',
    reason: 'Profile studentów widzą tylko zalogowani użytkownicy — chronimy ich prywatność.',
  },
  notifications: {
    feature: 'Powiadomienia',
    reason: 'Powiadomienia są przypisane do Twojego konta.',
  },
  settings: {
    feature: 'Ustawienia konta',
    reason: 'Ustawienia dotyczą Twojego konta.',
  },
  chat: {
    feature: 'Asystent Versuś',
    reason: 'Asystent korzysta z Twojego planu i ustawień, dlatego działa po zalogowaniu.',
    alternative: { label: 'Przeszukaj komunikaty i rejestracje', to: '/szukaj' },
  },
  aula: {
    feature: 'Aula',
    reason: 'Aula to czat Twojego rocznika — wiadomości widzą tylko jego członkowie.',
  },
  mojPlan: {
    feature: 'Mój plan',
    reason: 'Twój plan zajęć importowany z USOSweb jest prywatny i przypisany do konta.',
    alternative: { label: 'Sprawdź rejestracje USOS', to: '/rejestracje' },
  },
  znizki: {
    feature: 'Zniżki studenckie',
    reason: 'Katalog zniżek współtworzą zalogowani studenci (oceny, zgłoszenia).',
  },
  miejsca: {
    feature: 'Miejsca do nauki',
    reason: 'Miejsca do nauki pokazują obecność innych studentów, dlatego wymagają konta.',
  },
  usos: {
    feature: 'Alarmy rejestracji',
    reason: 'Przypomnienia o rejestracjach są przypisane do Twojego konta.',
    alternative: { label: 'Terminy rejestracji bez logowania', to: '/rejestracje' },
  },
  events: {
    feature: 'Wydarzenia społeczności',
    reason: 'Wydarzenia tworzone przez studentów i zapisy na nie są dostępne po zalogowaniu.',
    alternative: { label: 'Oficjalne wydarzenia UJ', to: '/wydarzenia' },
  },
  search: {
    feature: 'Wyszukiwarka społeczności',
    reason: 'Szukanie osób, wpisów i wiadomości wymaga konta.',
    alternative: { label: 'Szukaj komunikatów i rejestracji', to: '/szukaj' },
  },
  adminDiag: { feature: 'Panel administracyjny', reason: 'Ta część jest dostępna tylko dla administratorów.' },
  adminReports: { feature: 'Panel zgłoszeń', reason: 'Ta część jest dostępna tylko dla administratorów.' },
}
