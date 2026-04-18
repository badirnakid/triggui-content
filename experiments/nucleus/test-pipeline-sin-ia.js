/* ═══════════════════════════════════════════════════════════════════════════════
   test-pipeline-sin-ia.js — PRUEBA END-TO-END SIN LLAMADAS REALES A IA

   Demuestra que el pipeline determinista funciona completo.
   Usa un EditionNucleus realista simulado (como lo devolvería GPT-4o-mini).
   Ejecuta validación + renderers reales.
   
   Ejecutar: node test-pipeline-sin-ia.js
═══════════════════════════════════════════════════════════════════════════════ */

import { renderTarjetaES, renderTarjetaEN, renderOGTitle, renderWhatsAppCopy } from "./render-tarjeta.js";
import { validateNucleus, validateTarjeta } from "./triggui-quality-engine.js";

// Nucleus REALISTA para "El poder del ahora" de Eckhart Tolle
// (Este es el tipo de output que devolvería GPT-4o-mini con structured outputs strict:true)
const nucleusSimulado = {
  book_identity: {
    titulo_es: "El poder del ahora",
    titulo_en: "The Power of Now",
    autor: "Eckhart Tolle",
    idioma_original: "en"
  },
  truth: {
    es: "La mente no se calma obedeciéndola sino cambiando la relación con los pensamientos que produce",
    en: "The mind doesn't quiet by obeying it but by changing how you relate to the thoughts it produces"
  },
  tension: {
    es: "confundir al pensador con quien observa el pensamiento",
    en: "confusing the thinker with the one who watches the thought"
  },
  micro_action: {
    seconds: 30,
    verb_es: "observa",
    verb_en: "observe",
    instruction_es: "Observa el siguiente pensamiento que aparezca sin intentar cambiarlo ni seguirlo",
    instruction_en: "Observe the next thought that arises without trying to change it or follow it"
  },
  emotional_vector: {
    es: ["presencia", "quietud", "distancia", "testigo"],
    en: ["presence", "stillness", "distance", "witness"]
  },
  highlight_seeds: {
    top_es: "tú no eres tu pensamiento sino quien lo observa",
    top_en: "you are not your thought but the one observing it",
    bottom_es: "el ahora es la única puerta al silencio interior",
    bottom_en: "now is the only doorway to inner silence"
  },
  visual_tokens: {
    accent: "#d4a574",
    paper: "#0f1419",
    ink: "#f5f0e8",
    palette: ["#d4a574", "#8b9d83", "#5d7b8c", "#b89b7a"]
  },
  surface_hints: {
    dimension: "Bienestar",
    punto_hawkins: "Cero",
    franja_ideal: "madrugada"
  },
  confidence: {
    book_grounding: 0.9,
    specificity: 0.85,
    risk_of_generic: 0.2
  }
};

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  PRUEBA END-TO-END: Pipeline Nucleus → Tarjetas              ║");
console.log("║  (Sin llamadas reales a IA — nucleus simulado realista)      ║");
console.log("╚══════════════════════════════════════════════════════════════╝");

console.log("\n📖 Libro: El poder del ahora — Eckhart Tolle");

// FASE 1: Validación del Nucleus
console.log("\n─────────────────────────────────────────────");
console.log("FASE 1 — Validación del Nucleus");
console.log("─────────────────────────────────────────────");
const nv = validateNucleus(nucleusSimulado);
console.log(`Nivel: ${nv.nivel}`);
console.log(`Score: ${nv.passed}/${nv.total} (${(nv.score * 100).toFixed(1)}%)`);
console.log(`Aprobado: ${nv.aprobado ? "✅" : "❌"}`);
if (nv.failed.length > 0) console.log(`Fallidos: ${nv.failed.join(", ")}`);

// FASE 2: Renderer ES
console.log("\n─────────────────────────────────────────────");
console.log("FASE 2 — Renderer Tarjeta ES (determinista)");
console.log("─────────────────────────────────────────────");
const t0 = Date.now();
const tarjetaES = renderTarjetaES(nucleusSimulado);
const msES = Date.now() - t0;

console.log(`\n⏱  Tiempo: ${msES}ms (CERO llamadas IA)`);
console.log(`\n1. TÍTULO:    ${tarjetaES.titulo}`);
console.log(`2. TOP:       ${tarjetaES.parrafoTop}`);
console.log(`3. SUBTÍTULO: ${tarjetaES.subtitulo}`);
console.log(`4. BOTTOM:    ${tarjetaES.parrafoBot}`);
console.log(`\n🎨 STYLE:`, tarjetaES.style);

const vES = validateTarjeta(tarjetaES, "es");
console.log(`\n✓ Validación: ${vES.nivel} (${vES.passed}/${vES.total})`);
if (vES.failed.length > 0) console.log(`  Fallidos: ${vES.failed.join(", ")}`);

// FASE 3: Renderer EN
console.log("\n─────────────────────────────────────────────");
console.log("FASE 3 — Renderer Tarjeta EN (determinista)");
console.log("─────────────────────────────────────────────");
const t1 = Date.now();
const tarjetaEN = renderTarjetaEN(nucleusSimulado);
const msEN = Date.now() - t1;

console.log(`\n⏱  Tiempo: ${msEN}ms (CERO llamadas IA)`);
console.log(`\n1. TITLE:    ${tarjetaEN.titulo}`);
console.log(`2. TOP:      ${tarjetaEN.parrafoTop}`);
console.log(`3. SUBTITLE: ${tarjetaEN.subtitulo}`);
console.log(`4. BOTTOM:   ${tarjetaEN.parrafoBot}`);

const vEN = validateTarjeta(tarjetaEN, "en");
console.log(`\n✓ Validation: ${vEN.nivel} (${vEN.passed}/${vEN.total})`);
if (vEN.failed.length > 0) console.log(`  Failed: ${vEN.failed.join(", ")}`);

// FASE 4: Renderers adicionales (demostración de extensibilidad)
console.log("\n─────────────────────────────────────────────");
console.log("FASE 4 — Superficies extra desde el mismo Nucleus");
console.log("─────────────────────────────────────────────");
console.log(`\n🌐 OG Title ES: ${renderOGTitle(nucleusSimulado, "es")}`);
console.log(`🌐 OG Title EN: ${renderOGTitle(nucleusSimulado, "en")}`);
console.log(`\n📱 WhatsApp ES:`);
console.log(renderWhatsAppCopy(nucleusSimulado, "es"));
console.log(`\n📱 WhatsApp EN:`);
console.log(renderWhatsAppCopy(nucleusSimulado, "en"));

// RESUMEN
console.log("\n═════════════════════════════════════════════════════════════");
console.log("RESUMEN: de 1 nucleus → 4 artefactos sin llamadas extra a IA");
console.log("═════════════════════════════════════════════════════════════");
console.log(`Nucleus válido:     ${nv.aprobado ? "✅" : "❌"}`);
console.log(`Tarjeta ES válida:  ${vES.aprobado ? "✅" : "❌"}`);
console.log(`Tarjeta EN válida:  ${vEN.aprobado ? "✅" : "❌"}`);
console.log(`Tiempo total (renders): ${msES + msEN}ms`);
console.log(`\nEn v9.7.4 esto habría sido 7 llamadas a OpenAI con reintentos.`);
console.log(`Aquí: 1 llamada (simulada) + 0 reintentos + 4 renders deterministas.`);
