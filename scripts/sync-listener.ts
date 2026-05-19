import { createClient } from '@supabase/supabase-js';
import { Meilisearch } from 'meilisearch';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseServiceKey) {
  console.error("❌ BŁĄD: Brak klucza SUPABASE_SERVICE_ROLE_KEY w pliku .env.local!");
  process.exit(1);
}

// 1. Definicja klienta Supabase
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 2. Definicja klienta Meilisearch z Twoim hasłem
const meiliClient = new Meilisearch({
    host: 'http://localhost:7700',
    apiKey: 'Truskawka777' // Czyste hasło bez małpy!
  });

console.log('🚀 UJverse State-Diff Search Sync uruchomiony...');
console.log('🟢 POTOK POŁĄCZONY: Porównuję stany bazy danych i Meilisearch...');

async function syncDatabaseState() {
  try {
    // Pobierz aktualne posty z Postgresa
    const { data: dbPosts, error } = await supabase.from('posts').select('*');
    if (error) throw error;
    if (!dbPosts || dbPosts.length === 0) return;

    // Pobierz aktualne dokumenty z Meilisearch
    const index = meiliClient.index('ujverse_content');
    const meiliStats = await index.getStats();
    
    let existingIds: string[] = [];
    if (meiliStats.numberOfDocuments > 0) {
      const documents = await index.getDocuments({ limit: 1000 });
      existingIds = documents.results.map(doc => doc.id);
    }

    // Wylicz różnicę: czego brakuje w Meilisearch
    const missingPosts = dbPosts.filter(post => !existingIds.includes(post.id.toString()));

    if (missingPosts.length > 0) {
      console.log(`📥 Wykryto ${missingPosts.length} nieoznakowanych postów w bazie.`);
      
      const documents = missingPosts.map((record: any) => ({
        id: record.id.toString(),
        kind: 'post',
        title: record.title || '',
        body: record.body,
        department: record.department,
        created_at: record.created_at ? new Date(record.created_at).getTime() : Date.now()
      }));

      await index.addDocuments(documents);
      console.log(`⚡ Zsynchronizowano pomyślnie ${documents.length} nowych dokumentów z Meilisearch!`);
    }
  } catch (err) {
    console.error('❌ Błąd krytyczny potoku porównania stanu:', err);
  }
}

// Sprawdzaj i porównuj stan co 2 sekundy
setInterval(syncDatabaseState, 2000);