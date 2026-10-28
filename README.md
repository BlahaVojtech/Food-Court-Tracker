# 🍔 Food Court Tracker — Forum Nová Karolina

Webový záznamník navštívených restaurací a podniků ve **Forum Nová Karolina v Ostravě**,
postavený nad **skutečným půdorysem** z oficiální mapy centra a zasazený do **georeferencované
mapy okolí** z OpenStreetMap.

Po nahrání na PHP hosting se data ukládají do **společné (globální) databáze** na serveru mimo
veřejnou složku webu — všechna zařízení vidí stejný stav. `api.php` použije SQLite
(`foodcourt.sqlite`), nebo JSON (`foodcourt-data.json`) jako fallback; nic se neinstaluje.
`localStorage` slouží jako lokální kopie a offline fronta: změny, které se nepodařilo odeslat,
se odešlou při další synchronizaci. Při prvním připojení se existující lokální data nahrají na server.
Bez PHP (např. lokální náhled) aplikace funguje jen s `localStorage`.

## Funkce

- **Interaktivní mapa se skutečným půdorysem** — 5 pater, 262 jednotek převzatých z oficiální
  navigace centra (`forumnovakarolina.cz/mapa-centra/`)
- **Správná geografická orientace** — půdorys je převeden do UTM 34N a vykreslen **severem nahoru**,
  stejně jako na mapy.cz nebo Google Maps (viz [Georeference](#georeference))
- **Skutečné okolí z OpenStreetMap** — budovy, silnice, železniční i tramvajové koleje,
  zeleň, parkoviště a názvy ulic kolem centra
- **Skutečná loga podniků** místo ikon, rasterizovaná do WebP
- **Červená = nenavštíveno, zelená = navštíveno** — stav je vidět na první pohled
- **Podniky v okolí centra** — Frankie's Pub, Kanteen Organica a Cokafe jsou vidět nad každým patrem
- Plynulý **pan & zoom** jako u reálné mapy (kolečko, tažení, pinch na mobilu, dvojklik)
- **Kompas a grafické měřítko**, **LOD popisky** podle přiblížení
- Klik na podnik v mapě i v seznamu otevře **stejný detail** — odškrtnutí, hodnocení
  hvězdičkami, datum návštěvy a poznámka. Dvojklik v mapě přepíná navštíveno.
- **Povinný výběr osoby při hodnocení** — žádné otravné přihlašování ani registrace heslem! Při hodnocení nebo odškrtnutí návštěvy jednoduše vyberete, kdo to píše (**Vojta**, **Peťa**, **Adél**).
- **Možnost přidat nového člověka & logo** — jedním klikem přidáte dalšího kamaráda, zvolíte mu vlastní symbol/logo/emoji a barvu na mapě.
- **Přehled hodnocení od každého z party** — v detailu každého podniku přehledně vidíte, kdo z party tam byl, jaké dal hodnocení hvězdičkami a co si dal dobrého.
- **Chytré přepínání pohledu na mapu**:
  - **Pohled „Všichni“** — celková mapa návštěv celé party (jaké podniky už někdo z vás navštívil, s odznáčky log návštěvníků).
  - **Pohled „👑 Vojta“** — mapa návštěv Vojty.
  - **Pohled „🍕 Peťa“** — mapa návštěv Péti.
  - **Pohled „✨ Adél“** — mapa návštěv Adél (a dalších přidaných lidí).
- **Žebříček návštěvnosti party & statistiky** — zjistěte, kdo z vás má nejvíce zářezů, které podniky jste navštívili všichni společně a kde naopak ještě nikdo z party nebyl.
- **Cloudová databáze pro Vercel (Supabase PostgreSQL)** s automatickým lokálním režimem v prohlížeči.
- Responzivní design (Tailwind CSS), funguje na mobilu i desktopu

## Nasazení na Vercel + Supabase Databázi

Web běží jako rychlá statická aplikace přímo na **Vercelu**, zatímco data o návštěvách a recenzích se ukládají do sdílené cloudové databáze **Supabase** (zdarma a bez nutnosti spravovat server):

1. **Založení databáze v Supabase (zdarma)**:
   - Na [supabase.com](https://supabase.com) založte nový projekt zdarma.
   - V levém menu otevřete **SQL Editor** -> **New query**.
   - Zkopírujte obsah souboru [`supabase-schema.sql`](supabase-schema.sql) a spusťte jej (**Run**).
   - Tím se vytvoří tabulky `members` (s výchozími osobami Vojta, Peťa, Adél) a `reviews`.
2. **Klíče k databázi**:
   - V Supabase otevřete **Project Settings** -> **API**.
   - Zkopírujte **Project URL** a **anon public key**.
3. **Nasazení na Vercel**:
   - Nahrajte repozitář na GitHub a importujte do [Vercel](https://vercel.com). Vercel nasadí web okamžitě (soubor [`vercel.json`](vercel.json) je již připraven).
   - Na nasazeném webu klikněte na tlačítko **Data** -> **Nastavení Supabase databáze** a vložte zkopírované klíče (nebo je zadejte přímo do [`config.js`](config.js)).
4. **Fungování bez konfigurace**:
   - Bez zadaných klíčů běží web plně lokálně v prohlížeči (s přednastavenými ukázkami pro Vojtu, Peťu i Adél). Jakmile klíče zadáte, přepne se na živý cloud.

## Spuštění lokálně

```bash
git clone https://github.com/BlahaVojtech/Food-Court-Tracker.git
cd Food-Court-Tracker
python -m http.server 8777        # nebo: npm start
# → http://localhost:8777
```

## Struktura

| Soubor | Popis |
|---|---|
| `index.html` | Kostra aplikace, záhlaví s loginem a přepínačem zobrazení, SVG mapa |
| `config.js` | Konfigurace cloudové databáze (Supabase URL & anon key) |
| `db.js` | Databázová vrstva: Supabase Auth, ukládání recenzí, komunitní statistiky, porovnávání uživatelů a offline demo |
| `supabase-schema.sql` | SQL schéma pro Supabase (tabulky `profiles`, `venue_reviews`, RLS politiky, triggery) |
| `vercel.json` | Konfigurace pro nasazení na Vercel (clean URLs, hlavičky, cache) |
| `styles.css` | Styly mapy, uživatelských avatarů, recenzních karet a komunitních prvků |
| `tailwind.css` | **Generované** Tailwind CSS (`npm run build:css`) |
| `app.js` | Logika aplikace: mapa, přepínač pohledů (Moje / Komunita / Přítel), detail s recenzemi, žebříček |
| `api.php` | Alternativní bezinstalační PHP SQLite backend pro klasické webhostingy |
| `plan.js` | **Generovaný** půdorys: `FLOORS` (5 pater × jednotky) + `VENUES` (34 podniků) |
| `surround.js` | **Generované** okolí z OpenStreetMap + silueta centra + rámec mapy |
| `extra.js` | **Generované** podniky v okolí centra, které nejsou v půdorysu |
| `logos/*.webp` | **Generovaná** loga podniků (34×, celkem ~120 kB) |
| `logos.js` | **Generovaný** rejstřík log (rozměry pro poměr stran odznaku) |
| `tools/` | Generátory dat |

## Patra

| ID | Označení v datasetu | Jednotek | Sledovaných podniků |
|---|---|---|---|
| `p2` | `B1-P2` | 72 | 21 — **food court** |
| `p1` | `B1-P1` | 68 | 2 |
| `p0` | `B1-P0` | 86 | 6 |
| `m1` | `B1-P-1` | 12 | 2 |
| `m2` | `B1-P-2` | 24 | 3 |
| `out` | — (OpenStreetMap) | 3 | 3 — okolí centra, vidět vždy |

## Zdroje dat

1. **Seznam podniků + popisy** — WordPress REST API centra
   ```
   https://forumnovakarolina.cz/wp-json/wp/v2/obchody?per_page=100&kategorie_obchodu=133,134,135,136
   ```
2. **Půdorys, patra, obrysy jednotek a loga** — mapový dataset VisioGlobe, který pohání oficiální
   mapu centra (`/mapa-centra/` → iframe `navigace-v-centru.cz/karolina/web`)
   ```
   https://mapserver.visioglobe.com/k19d1d6774c3496889970fb022d6e1cfdd08cf187/map.json
   https://navigace-v-centru.cz/karolina/js/data_core.min.js
   ```
3. **Okolí a podniky v okolí** — OpenStreetMap přes Overpass API (© přispěvatelé OpenStreetMap, ODbL)

### Regenerace dat

Velké zdrojové dumpy nejsou v repozitáři (viz `.gitignore`), stáhnou se takto:

```bash
npm install
cd tools
curl -o vgmap.json https://mapserver.visioglobe.com/k19d1d6774c3496889970fb022d6e1cfdd08cf187/map.json
curl -o dc.js      https://navigace-v-centru.cz/karolina/js/data_core.min.js
node fetch-osm.js          # → tools/osm.json (Overpass)
cd ..
npm run build              # → tailwind.css, plan.js, logos/, surround.js, extra.js
```

| Skript | Výstup |
|---|---|
| `tools/build-plan.js` | `plan.js`, `logos.js`, `logos/*.webp` |
| `tools/build-surround.js` | `surround.js` (okolí + silueta centra) |
| `tools/build-extra.js` | `extra.js` (Frankie's, Kanteen, Cokafe) + `organica.js` (půdorys Organiky podle organicaostrava.cz/retail) |
| `tools/build-organica-logos.js` | `logos/kanteen.webp`, `logos/cokafe.webp` |
| `tools/extract-organica.js` | jednorázově: `tools/organica/plan.json` z oficiálního SVG plánu |
| `tools/frame.js` | společný souřadnicový rámec — používají ho všechny generátory |
| `tools/geo.js` | převody UTM 34N ↔ WGS84, bez závislostí |

## Georeference

`map.json` obsahuje v klíči `geoinformation` plnou georeferenci:

```json
{ "rotation_angle_in_degrees": 5.97051092, "meters_per_pixel": 0.25,
  "geo_xref": 304545.61510846537, "geo_yref": 5523064.782834832,
  "proj": "utm --zone 34 --north" }
```

Převod pixelu půdorysu na UTM 34N:

```js
y_geo = svgHeight - y_pixel          // překlopení osy Y (zdroj je v SVG prostoru, y dolů)
dx = x_pixel * 0.25, dy = y_geo * 0.25
E = geo_xref + dx*cos(θ) - dy*sin(θ)
N = geo_yref + dx*sin(θ) + dy*cos(θ)
```

Správná varianta byla ověřena měřením překryvu (IoU) s footprintem budovy
*Forum Nová Karolina* v OpenStreetMap (`way 98290906`):

| překlopení Y | znaménko rotace | IoU |
|---|---|---|
| ne | +1 | 0,448 |
| ne | −1 | 0,173 |
| **ano** | **+1** | **0,616** ✅ |
| ano | −1 | 0,200 |

Zbytkový nesoulad je dán tím, že jednotky půdorysu nevyplňují atria a chodby.

**Světový rámec** (`tools/frame.js`): 1 jednotka = 0,25 m, výřez 410 × 410 m se středem
v těžišti centra. `x` roste k východu, `y` k jihu → **sever je nahoře**.

## Výkon

Aplikace je laděná na plynulý pan/zoom i na slabších strojích:

- **Statická vrstva** (mřížka, okolí, silueta centra) se vykreslí **jen jednou**, ne při každé změně patra
- **Cache vrstev pater** — patro se po prvním zobrazení jen přepíná přes `display`
- **Event delegace** — jeden posluchač na celý viewport místo tří na každou z ~90 jednotek
- **LOD jen při změně zoomu** — při pouhém posunu se ~400 uzlů vůbec neprochází
- Atributy se zapisují jen při skutečné změně hodnoty (`Map`/`WeakMap` lookupy místo `find()` v cyklech)
- **Douglas-Peucker** zjednodušení geometrie OSM + zaokrouhlení souřadnic
  (`surround.js` 55 → 27 kB, `plan.js` 138 → 103 kB)
- Loga jako **WebP** místo inline SVG v JavaScriptu (366 kB JS → 120 kB obrázků načítaných líně)
- **Předkompilovaný Tailwind** (20 kB CSS) místo ~120 kB blokujícího JS z `cdn.tailwindcss.com`

## Uložená data

Databáze `foodcourt.sqlite` obsahuje aktuální stav v tabulce `venues` a historii změn v tabulce
`venue_actions`. Každá změna návštěvy, hodnocení, komentáře nebo data návštěvy se uloží jako akce.

Záložní klíč `localStorage`: **`fnk-foodcourt-v1`**

```json
{ "kfc": { "visited": true, "rating": 4, "date": "2025-03-12", "note": "..." } }
```

Tlačítko *Smazat vše* smaže stav i na serveru (historie změn zůstane). Export/import je v okně *Data*.

---

Neoficiální projekt, není nijak spojen s provozovatelem obchodního centra.
Mapová data okolí © přispěvatelé [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).
