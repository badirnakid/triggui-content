// 🔬 Status de TODAS las fuentes posibles + qué responden con query trivial

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function main() {
  console.log("🔬 STATUS DE FUENTES (1 query trivial cada una)\n");

  // ─── 1. Google Books ─────────────────────────────────────────────────
  console.log("─── 1. Google Books — query trivial 'harry potter' ───");
  try {
    const r = await fetch("https://www.googleapis.com/books/v1/volumes?q=harry+potter&maxResults=1");
    console.log(`   status: ${r.status}`);
    const d = await r.json();
    console.log(`   totalItems: ${d.totalItems}`);
    if (d.error) console.log(`   ❌ ERROR: ${JSON.stringify(d.error).slice(0, 300)}`);
    if (d.items?.[0]) {
      console.log(`   ✓ funciona — "${d.items[0].volumeInfo?.title}"`);
      const il = d.items[0].volumeInfo?.imageLinks;
      console.log(`   imageLinks keys: [${Object.keys(il || {}).join(", ")}]`);
    }
  } catch (e) { console.log(`   ❌ ERROR: ${e.message}`); }

  // ─── 2. Buscalibre — ver el contenido de los 2371 bytes ─────────────
  console.log("\n─── 2. Buscalibre — qué contiene el response 202 ───");
  try {
    const r = await fetch("https://www.buscalibre.com.mx/libros/search/?q=harry+potter", {
      headers: { "User-Agent": UA, "Accept": "text/html", "Accept-Language": "es-MX,es;q=0.9" },
    });
    console.log(`   status: ${r.status}`);
    console.log(`   server: ${r.headers.get("server") || "?"}`);
    console.log(`   cf-ray: ${r.headers.get("cf-ray") || "no es cloudflare"}`);
    const html = await r.text();
    console.log(`   size: ${html.length} bytes`);
    console.log(`   ─── primeros 1500 chars del HTML ───`);
    console.log(html.slice(0, 1500));
    console.log(`   ─── final ───`);
  } catch (e) { console.log(`   ❌ ERROR: ${e.message}`); }

  // ─── 3. Apple Books — confirmar que aún funciona ─────────────────────
  console.log("\n─── 3. Apple Books — query trivial 'harry potter' ───");
  try {
    const r = await fetch("https://itunes.apple.com/search?term=harry+potter&entity=ebook&limit=1&country=mx");
    const d = await r.json();
    console.log(`   status: ${r.status}, resultCount: ${d.resultCount}`);
    if (d.results?.[0]) console.log(`   ✓ funciona — "${d.results[0].trackName}"`);
  } catch (e) { console.log(`   ❌ ERROR: ${e.message}`); }

  // ─── 4. OpenLibrary search ─────────────────────────────────────────
  console.log("\n─── 4. OpenLibrary search — query trivial ───");
  try {
    const r = await fetch("https://openlibrary.org/search.json?q=harry+potter&limit=1");
    const d = await r.json();
    console.log(`   status: ${r.status}, numFound: ${d.numFound}`);
    if (d.docs?.[0]) console.log(`   ✓ funciona — "${d.docs[0].title}"`);
  } catch (e) { console.log(`   ❌ ERROR: ${e.message}`); }

  // ─── 5. Amazon cover por ISBN (legacy, sin API key) ──────────────────
  console.log("\n─── 5. Amazon cover por ISBN — ISBN conocido ───");
  const amzUrl = `https://images.amazon.com/images/P/0590353403.jpg`;
  console.log(`   URL: ${amzUrl}`);
  try {
    const r = await fetch(amzUrl, { redirect: "follow" });
    const buf = await r.arrayBuffer();
    console.log(`   status: ${r.status}, bytes: ${buf.byteLength}, content-type: ${r.headers.get("content-type")}`);
    if (r.ok && buf.byteLength > 2048) console.log(`   ✓ funciona — usable como fuente`);
    else console.log(`   ⚠️ respuesta sospechosa (placeholder de 1x1 px probablemente)`);
  } catch (e) { console.log(`   ❌ ERROR: ${e.message}`); }

  // ─── 6. OpenLibrary cover por ISBN directo ──────────────────────────
  console.log("\n─── 6. OpenLibrary cover por ISBN directo ───");
  const olUrl = `https://covers.openlibrary.org/b/isbn/9780590353403-L.jpg`;
  console.log(`   URL: ${olUrl}`);
  try {
    const r = await fetch(olUrl, { redirect: "follow" });
    const buf = await r.arrayBuffer();
    console.log(`   status: ${r.status}, bytes: ${buf.byteLength}`);
    if (r.ok && buf.byteLength > 2048) console.log(`   ✓ funciona — usable como fuente`);
  } catch (e) { console.log(`   ❌ ERROR: ${e.message}`); }

  // ─── 7. Google Books OTRA VEZ pero con un libro distinto ─────────────
  console.log("\n─── 7. Google Books — query distinta para confirmar rate limit ───");
  try {
    const r = await fetch("https://www.googleapis.com/books/v1/volumes?q=javascript&maxResults=1");
    console.log(`   status: ${r.status}`);
    const d = await r.json();
    console.log(`   totalItems: ${d.totalItems}`);
    if (d.error) console.log(`   ❌ ERROR: ${JSON.stringify(d.error).slice(0, 200)}`);
  } catch (e) { console.log(`   ❌ ERROR: ${e.message}`); }
}

main();
