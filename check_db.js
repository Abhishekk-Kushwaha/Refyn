const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env from .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(
  env['VITE_SUPABASE_URL'],
  env['VITE_SUPABASE_ANON_KEY']
);

async function checkSchema() {
  console.log('=== Checking Supabase Schema ===\n');

  try {
    // Fetch from information schema
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (error) {
      console.log('RPC error:', error.message);
      return;
    }

    if (!tables || tables.length === 0) {
      console.log('❌ No tables found in public schema');
      return;
    }

    console.log(`✅ Found ${tables.length} tables in public schema:\n`);
    tables.forEach(t => console.log(`  - ${t.table_name}`));

    const expectedTables = [
      'profiles',
      'questions',
      'sessions',
      'attempts',
      'user_exams',
      'awe_state',
      'answer_votes'
    ];

    console.log('\n=== Expected Tables Status ===\n');
    const existing = new Set(tables.map(t => t.table_name));
    expectedTables.forEach(table => {
      if (existing.has(table)) {
        console.log(`✅ ${table}`);
      } else {
        console.log(`❌ MISSING: ${table}`);
      }
    });

  } catch (e) {
    console.error('Error:', e.message);
  }
}

checkSchema();
