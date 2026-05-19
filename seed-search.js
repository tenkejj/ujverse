import * as meili from 'meilisearch';

const MeiliSearchClass = meili.MeiliSearch || meili.default || meili.Meilisearch;

const client = new MeiliSearchClass({
  host: 'http://localhost:7700',
  apiKey: '767e21bf606d822122fec1d65ef5d5a34d5702708f4e635ab2c8037468cb0dd3', // Twój aktualny Admin Key
});

// Tworzymy makiety danych zawierające 'author' oraz czyszczące pole 'title' na wszelki wypadek
const mockPosts = [
  { 
    id: 'post_1', 
    title: 'Wykład otwarty na WZiKS UJ', 
    content: 'Już w najbliższy czwartek zapraszamy na spotkanie z ekspertami od AI. Sala 1.03, start o godzinie 12:00.',
    author: 'Wydział Zarządzania',
    category: 'Edukacja'
  },
  { 
    id: 'post_2', 
    title: 'Juwenalia Krakowskie 2026 – Strefa UJ', 
    content: 'Znamy już pełny line-up artystów, którzy zagrają na tegorocznych Juwenaliach! Bilety studenckie do kupienia w klubie Żaczek.',
    author: 'Samorząd Studentów UJ',
    category: 'Rozrywka'
  },
  { 
    id: 'post_3', 
    title: 'Prace konserwatorskie w Bibliotece Jagiellońskiej', 
    content: 'W dniach 20-25 maja Czytelnia Główna BJ będzie zamknięta z powodu corocznego skontrum zbiorów.',
    author: 'Administracja BJ',
    category: 'Komunikaty'
  }
];

async function run() {
  console.log('🚀 Rozpoczynam re-indeksowanie bogatych danych...');
  try {
    const index = client.index('ujverse_content');
    
    // Nadpisujemy stare dokumenty nowymi z polem author
    const response = await index.addDocuments(mockPosts);
    console.log('✅ Dane z polem author wysłane do Meilisearch! ID zadania:', response.taskUid);
  } catch (error) {
    console.error('❌ Błąd seederów:', error);
  }
}

run();