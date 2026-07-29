import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

  const expectedTables = [
    'profiles',
    'questions',
    'sessions',
    'attempts',
    'user_exams',
    'awe_state',
    'answer_votes'
  ];

  const results = { existing: [], missing: [] };

  for (const table of expectedTables) {
    try {
      const { error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01') {
          results.missing.push(table);
        } else {
          console.log(`  ⚠️  ${table}: ${error.message}`);
        }
      } else {
        results.existing.push({ table, count });
      }
    } catch (e) {
      results.missing.push(table);
    }
  }

  if (results.existing.length > 0) {
    console.log('✅ EXISTING TABLES:\n');
    results.existing.forEach(({ table, count }) => {
      console.log(`  ✅ ${table} (${count ?? 0} rows)`);
    });
  }

  if (results.missing.length > 0) {
    console.log('\n❌ MISSING TABLES:\n');
    results.missing.forEach(table => {
      console.log(`  ❌ ${table}`);
    });
  }

  console.log('\n=== Action Required ===\n');
  console.log('Run in Supabase SQL Editor (in order):');
  console.log('  1. SQL/master_setup.sql');
  console.log('  2. SQL/phase1_awe_state.sql');
  console.log('  3. SQL/phase1_fix_auth_trigger.sql');
  console.log('  4. SQL/seed_questions_part*.sql (in order)\n');
}

checkSchema();
