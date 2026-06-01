// scripts/backfill-tags.ts
import { createClient } from '@supabase/supabase-js';
import { extractPostTags } from '../src/lib/postTags';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function runBackfill() {
  console.log('--- Rozpoczynam backfill tagów ---');
  
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, content')
    .eq('tags', []);

  if (error) throw error;
  if (!posts || posts.length === 0) {
    console.log('Brak postów do przetworzenia.');
    return;
  }

  for (const post of posts) {
    const tags = extractPostTags(post.content || '');
    if (tags.length > 0) {
      const { error: updateError } = await supabase
        .from('posts')
        .update({ tags })
        .eq('id', post.id);
        
      if (updateError) {
        console.error(`Błąd przy update post ${post.id}:`, updateError);
      } else {
        console.log(`Zaktualizowano post ${post.id}: [${tags.join(', ')}]`);
      }
    }
  }
  
  console.log('--- Backfill zakończony ---');
}

runBackfill().catch(console.error);