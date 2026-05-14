// scripts/inject-portadas.mjs
// 💉 Inyecta las URLs aprobadas en contenido.json y contenido_kids.json.
// Solo actualiza campos `portada` y `portada_url`. Cero cambios al contenido editorial.
// Crea backup automático antes de escribir.

import fs from "node:fs/promises";
import path from "node:path";

const CONTENT_DIR = "/workspaces/triggui-content";

// ─── Selección manual (1, 2, o 3) por libro. Default = 1 ─────────────
// Para cambiar uno, edita el número aquí y vuelve a correr.
const SELECCIONES = {
  "Rompe con tu zona de confort: 52 propuestas para tomar las riendas de tu vida": 1,
  "Pequeno Libro De Instrucciones Para La Vida": 1,
  "Play Nice But Win: A CEO's Journey from Founder to Leader": 1,
  "Gracias. El arte de comunicar malas noticias con humanidad": 1,
  "El VERDADERO ARTE DEL MASTER COACH: Colección de Coaching Sistémico": 1,
  "Buenas noches luna": 2,             // ⚠️ ajustado: #1 era versión "123 Board Book"
  "La materia oscura La brújula dorada": 1,
  "La pequeña casa en la pradera": 1,
  "La sastrería de Gloucester": 1,
  "La telaraña de Carlota": 1,
  "La casa del árbol El valle de los dinosaurios": 1,
  "Las brujas": 1,
  "Fantastic Mr. Fox": 2,              // ⚠️ ajustado: #1 era "Lit Link" (libro de actividades)
};

async function main() {
  // Cargar recovery
  const recovery = JSON.parse(await fs.readFile(`${CONTENT_DIR}/recovery-final.json`, "utf8"));
  console.log(`📋 Procesando ${recovery.length} libros desde recovery-final.json\n`);

  // Separar por catálogo
  const byCatalog = { adulto: [], kids: [] };
  for (const r of recovery) {
    if (!r.candidates?.length) {
      console.log(`⚠️  Sin candidatos: [${r.catalog}] "${r.titulo_json}" — SVG fallback se queda`);
      continue;
    }
    const sel = SELECCIONES[r.titulo_json] || 1;
    const chosen = r.candidates[sel - 1] || r.candidates[0];
    byCatalog[r.catalog].push({
      titulo: r.titulo_json,
      seleccion: sel,
      url: chosen.url,
      titulo_devuelto: chosen.title,
      autor_devuelto: chosen.author,
      source: chosen.source,
      bytes: chosen.validation?.bytes,
    });
  }

  console.log(`📚 ${byCatalog.adulto.length} adultos + ${byCatalog.kids.length} kids para inyectar\n`);

  // Procesar cada JSON
  for (const [catalog, items] of Object.entries(byCatalog)) {
    if (!items.length) continue;
    const jsonName = catalog === "adulto" ? "contenido.json" : "contenido_kids.json";
    const jsonPath = path.join(CONTENT_DIR, jsonName);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📂 ${jsonName}`);

    // Backup
    const backupPath = `${jsonPath}.backup-${Date.now()}.json`;
    await fs.copyFile(jsonPath, backupPath);
    console.log(`💾 Backup: ${path.basename(backupPath)}`);

    // Leer JSON
    const data = JSON.parse(await fs.readFile(jsonPath, "utf8"));
    const lista = data.libros || data.ediciones || data;
    if (!Array.isArray(lista)) throw new Error(`Estructura inesperada en ${jsonName}`);

    let cambios = 0;
    for (const item of items) {
      // Buscar el libro por título (match flexible)
      const idx = lista.findIndex(l => {
        const titulo = l.titulo || l.libro?.titulo || "";
        return titulo === item.titulo;
      });

      if (idx === -1) {
        console.log(`   ❌ NO encontrado: "${item.titulo}"`);
        continue;
      }

      const target = lista[idx];
      const beforePortada = target.portada || target.libro?.portada;
      const beforeUrl = target.portada_url || target.libro?.portada_url;

      // Update portada y portada_url (en raíz o en .libro)
      if (target.libro) {
        target.libro.portada = item.url;
        target.libro.portada_url = item.url;
      }
      target.portada = item.url;
      target.portada_url = item.url;

      cambios++;
      const wasSvg = String(beforePortada).startsWith("data:image/svg") || String(beforeUrl).startsWith("data:image/svg");
      console.log(`   ✅ #${item.seleccion} → "${item.titulo.slice(0, 55)}"`);
      console.log(`      antes: ${wasSvg ? "SVG fallback" : (beforePortada || "—").slice(0, 60)}`);
      console.log(`      ahora: ${item.url.slice(0, 80)}`);
      console.log(`      fuente: ${item.source} (${item.bytes} bytes)\n`);
    }

    // Escribir
    await fs.writeFile(jsonPath, JSON.stringify(data, null, 2));
    console.log(`✓ ${cambios}/${items.length} libros actualizados en ${jsonName}`);
  }

  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`🏆 INYECCIÓN COMPLETA`);
  console.log(`══════════════════════════════════════════════════════════════`);
  console.log(`Próximos pasos:`);
  console.log(`  1. git diff contenido.json contenido_kids.json   ← revisar cambios`);
  console.log(`  2. Verificar visualmente que las URLs cargan`);
  console.log(`  3. git add . && git commit -m "fix: portadas via cascade nivel dios (14/14)"`);
  console.log(`  4. git push`);
  console.log(`\nBackups en: ${CONTENT_DIR}/*.backup-*.json (eliminar después)`);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
