const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

function getFiles(dir) {
  const subdirs = fs.readdirSync(dir);
  const files = subdirs.map(subdir => {
    const res = path.resolve(dir, subdir);
    return fs.statSync(res).isDirectory() ? getFiles(res) : res;
  });
  return files.reduce((a, f) => a.concat(f), []);
}

const srcFiles = getFiles(path.join(process.cwd(), 'src')).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

const queries = [];

for (const file of srcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(process.cwd(), file);

  // Match supabase.from('table') followed by chain
  const chainRegex = /(?:supabase|client)\s*\.\s*from(?:<[^>]+>)?\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)([\s\S]*?)(?=(?:supabase|client)\s*\.\s*from|const |let |return |function |export |;|(?:\r?\n\s*\r?\n))/g;
  let match;
  while ((match = chainRegex.exec(content)) !== null) {
    const table = match[1];
    const chain = match[2];

    // Extract select(...)
    const selectMatch = chain.match(/\.select\(\s*[`'"]([\s\S]*?)[`'"]\s*\)/);
    if (selectMatch) {
      queries.push({ file: relPath, table, type: 'select', raw: selectMatch[1] });
    }

    // Extract insert(...)
    const insertMatch = chain.match(/\.insert\(\s*([\s\S]*?)\s*\)/);
    if (insertMatch) {
      queries.push({ file: relPath, table, type: 'insert', raw: insertMatch[1] });
    }

    // Extract update(...)
    const updateMatch = chain.match(/\.update\(\s*([\s\S]*?)\s*\)/);
    if (updateMatch) {
      queries.push({ file: relPath, table, type: 'update', raw: updateMatch[1] });
    }

    // Extract eq, neq, order
    const colFilterRegex = /\.(?:eq|neq|gt|gte|lt|lte|order)\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
    let cfMatch;
    while ((cfMatch = colFilterRegex.exec(chain)) !== null) {
      queries.push({ file: relPath, table, type: 'filter', col: cfMatch[1] });
    }
  }
}

console.log(`Extracted ${queries.length} Supabase operations across frontend.`);

// Extract actual column names to test per table
const tableColumns = {};

for (const q of queries) {
  if (!tableColumns[q.table]) tableColumns[q.table] = new Map();

  if (q.type === 'select') {
    // Split by comma
    // Strip joins like profiles(email, full_name)
    const stripped = q.raw.replace(/\([^\)]*\)/g, '');
    const cols = stripped.split(',').map(s => s.trim().split(':')[0].trim()).filter(s => s && s !== '*' && /^[a-zA-Z0-9_]+$/.test(s));
    for (const c of cols) {
      if (!tableColumns[q.table].has(c)) tableColumns[q.table].set(c, []);
      tableColumns[q.table].get(c).push(`${q.file} (select)`);
    }
  } else if (q.type === 'insert' || q.type === 'update') {
    // If it's an object literal
    const keys = [];
    const keyRegex = /([a-zA-Z0-9_]+)\s*:/g;
    let k;
    while ((k = keyRegex.exec(q.raw)) !== null) {
      const key = k[1];
      if (!['data', 'error', 'body', 'headers', 'count', 'head', 'schema'].includes(key)) {
        keys.push(key);
      }
    }
    for (const c of keys) {
      if (!tableColumns[q.table].has(c)) tableColumns[q.table].set(c, []);
      tableColumns[q.table].get(c).push(`${q.file} (${q.type})`);
    }
  } else if (q.type === 'filter') {
    if (!tableColumns[q.table].has(q.col)) tableColumns[q.table].set(q.col, []);
    tableColumns[q.table].get(q.col).push(`${q.file} (filter)`);
  }
}

async function verify() {
  console.log('--- TESTING REAL COLUMNS ON SUPABASE ---');
  const discrepancies = [];

  for (const [table, colsMap] of Object.entries(tableColumns)) {
    const cols = Array.from(colsMap.keys());
    await Promise.all(cols.map(async col => {
      const res = await supabase.from(table).select(col).limit(0);
      if (res.error && (res.error.code === '42703' || res.error.message?.includes('does not exist'))) {
        discrepancies.push({
          table,
          col,
          error: res.error.message,
          occurrences: colsMap.get(col)
        });
      }
    }));
  }

  console.log(`\nFound ${discrepancies.length} actual discrepancies:`);
  for (const d of discrepancies) {
    console.log(`\n❌ Table: [${d.table}] | Column: [${d.col}]`);
    console.log(`   Error: ${d.error}`);
    console.log(`   Used in:`);
    d.occurrences.forEach(occ => console.log(`     - ${occ}`));
  }

  fs.writeFileSync('scripts/frontend-discrepancies.json', JSON.stringify(discrepancies, null, 2));
}

verify();
