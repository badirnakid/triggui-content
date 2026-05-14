// scripts/delete-slim.mjs
// 🗑️ Elimina "Slim" de todos los catálogos.
// Default: dry-run (preview). Con --apply: ejecuta con backups.

import fs from "node:fs/promises";

const CONTENT_DIR = "/workspaces/triggui-content";
const APPLY = process.argv.includes("--apply");
const matchSlim = (titulo) => /\bslim\b/i.test(titulo || "");

const FILES = [
  { path: "contenido.json", type: "json" },
  { path: "data/libros_master.csv", type: "csv" },
  { path: "recovery-final.json", type: "json" },
  { path: "audit-portadas-fallback.json", type: "json" },
];

async function processJson(filePath) {
  const txt = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(txt);

  // Detectar estructura
  let lista, key;
  if (Array.isArray(data)) { lista = data; key = "_array"; }
  else if (Array.isArray(data.libros)) { lista = data.libros; key = "libros"; }
  else if (Array.isArray(data.ediciones)) { lista = data.ediciones; key = "ediciones"; }
  else return { found: 0, items: [] };

  const found = [];
  const filtered = lista.filter(item => {
    const titulo = item.titulo || item.titulo_json || item.libro?.titulo || "";
    if (matchSlim(titulo)) {
      const autor = item.autor || item.autor_json || item.autor_csv || item.libro?.autor || "?";
      found.push({ titulo, autor });
      return false;
    }
    return true;
  });

  if (APPLY) {
    if (key === "_array") {
      await fs.writeFile(filePath, JSON.stringify(filtered, null, 2));
    } else {
      data[key] = filtered;
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }
  }

  return { found: found.length, items: found };
}

async function processCsv(filePath) {
  const txt = await fs.readFile(filePath, "utf8");
  const lines = txt.split("\n");
  if (!lines.length) return { found: 0, items: [] };

  const header = lines[0];
  // Detectar columna título (busca header con "titulo" o "title")
  const cols = header.split(",").map(c => c.replace(/["\s]/g, "").toLowerCase());
  const tituloCol = cols.findIndex(c => c === "titulo" || c === "title");
  if (tituloCol === -1) {
    console.log(`   ⚠️ No detecté columna 'titulo' en header del CSV. Header: ${header.slice(0, 200)}`);
    return { found: 0, items: [] };
  }

  const found = [];
  const kept = [header];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { kept.push(line); continue; }
    // Parse simple respetando comillas
    const fields = line.match(/("[^"]*"|[^,]+)/g) || [];
    const titulo = (fields[tituloCol] || "").replace(/^"|"$/g, "");
    if (matchSlim(titulo)) {
      found.push({ titulo, line: line.slice(0, 120) });
    } else {
      kept.push(line);
    }
  }

  if (APPLY) await fs.writeFile(filePath, kept.join("\n"));
  return { found: found.length, items: found };
}

async function main() {
  console.log(APPLY 
    ? "🔥 MODO APPLY — eliminando con backups\n"
    : "👀 MODO DRY-RUN — solo preview (corre con --apply para ejecutar)\n");

  const summary = [];
  for (const f of FILES) {
    const fullPath = `${CONTENT_DIR}/${f.path}`;
    try { await fs.access(fullPath); } catch {
      console.log(`⊘ ${f.path} — no existe, skip`);
      continue;
    }

    if (APPLY) {
      const backupPath = `${fullPath}.backup-${Date.now()}`;
      await fs.copyFile(fullPath, backupPath);
      console.log(`💾 Backup: ${f.path}.backup-...`);
    }

    const result = f.type === "json" ? await processJson(fullPath) : await processCsv(fullPath);
    summary.push({ file: f.path, ...result });

    console.log(`\n📂 ${f.path}`);
    console.log(`   ${result.found} entrada(s) con "Slim"`);
    for (const item of result.items) {
      console.log(`     - "${item.titulo}"${item.autor ? ` — ${item.autor}` : ""}`);
    }
  }

  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`🏆 RESUMEN`);
  console.log(`══════════════════════════════════════════════════════════════`);
  const total = summary.reduce((acc, s) => acc + s.found, 0);
  console.log(`Total entradas con "Slim" encontradas: ${total}`);
  for (const s of summary) {
    if (s.found > 0) console.log(`   ${s.file}: ${s.found}`);
  }

  if (!APPLY && total > 0) {
    console.log(`\n→ Si se ve bien, ejecuta:`);
    console.log(`     node scripts/delete-slim.mjs --apply`);
  } else if (APPLY && total > 0) {
    console.log(`\n✅ Eliminado. Backups en ${CONTENT_DIR}/*.backup-*`);
    console.log(`Revisa con: git diff`);
    console.log(`Commit:     git add . && git commit -m "remove: Slim del catálogo"`);
  } else if (total === 0) {
    console.log(`\n(nada que eliminar)`);
  }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
