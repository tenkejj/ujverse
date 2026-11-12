import {
  BookOpen,
  ChevronDown,
  Cpu,
  Database,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react'
import '../../styles/versus-about.css'

const DETAILS = [
  {
    title: 'Jaki model?',
    Icon: Cpu,
    text: 'GPT-OSS od OpenAI, uruchamiany przez Groq. Wersja 20B obsługuje lżejsze zadania i układanie odpowiedzi z faktów, a 120B pracę z szerszym zestawem narzędzi.',
  },
  {
    title: 'Skąd bierze informacje?',
    Icon: Database,
    text: 'Z komunikatów, wydarzeń, terminów rejestracji i informacji o wykładowcach dostępnych w UJverse. Nie przeszukuje przy każdym pytaniu całego internetu.',
  },
  {
    title: 'Jak odpowiada?',
    Icon: MessageCircle,
    text: 'Dobiera potrzebne dane do pytania i układa z nich krótką odpowiedź. Część prostych pytań obsługuje bez wywołania modelu; może też skorzystać z niedawno przygotowanej odpowiedzi.',
  },
  {
    title: 'A mój plan i konto?',
    Icon: LockKeyhole,
    text: 'O informacje publiczne zapytasz bez logowania. Dane z Twojego konta, w tym plan dodany do UJverse, odczytuje dopiero po zalogowaniu i tylko dla Twojego konta.',
  },
  {
    title: 'Co trafia do modelu?',
    Icon: ShieldCheck,
    text: 'Gdy potrzebny jest model, do Groq trafiają pytanie, potrzebny fragment rozmowy i dane użyte do odpowiedzi. Sam czat nie zapisuje Cię na zajęcia ani nie zmienia spraw w USOS.',
  },
  {
    title: 'O czym warto pamiętać?',
    Icon: BookOpen,
    text: 'Versuś jest nieoficjalnym asystentem UJverse. Dane mogą być opóźnione, a odpowiedź błędna — ważne terminy potwierdź w źródle. Po wyczerpaniu limitu może poprosić o chwilę przerwy.',
  },
] as const

/** Product explanation stays available without competing with the first message. */
export default function VersusAbout() {
  return (
    <details className="versus-about" id="o-versusiu">
      <summary>
        O Versusiu <ChevronDown size={14} aria-hidden />
      </summary>
      <dl className="versus-about-content">
        {DETAILS.map(({ title, text, Icon }) => (
          <div key={title}>
            <dt>
              <Icon size={18} strokeWidth={1.75} aria-hidden />
              {title}
            </dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
