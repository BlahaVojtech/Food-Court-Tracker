# 🍔 Food Court Tracker — Forum Nová Karolina

Webový záznamník navštívených restaurací a podniků ve **Forum Nová Karolina v Ostravě**,
postavený nad **skutečným půdorysem** z oficiální mapy centra.

Vše běží čistě v prohlížeči — **žádný backend, žádná databáze**. Data se ukládají do `localStorage`.

## Funkce

- **Interaktivní mapa se skutečným půdorysem** — 5 pater, 262 jednotek převzatých z oficiální
  navigace centra (`forumnovakarolina.cz/mapa-centra/`), ve stejné orientaci jako originál
- **Skutečná loga podniků** místo ikon — také z dat oficiální navigace
- **Červená = nenavštíveno, zelená = navštíveno** — stav je vidět na první pohled
- **Schematické okolí** — ul. Jantarová, 28. října, Porážková, železniční koleje,
  Trojhalí Karolina, Organica Building, Nová Karolina Park, parkoviště a park
- Plynulý **pan & zoom** jako u reálné mapy (kolečko, tažení, pinch na mobilu, dvojklik)
- **LOD popisky** — názvy jednotek se objevují podle přiblížení, aby se nepřekrývaly
- Odškrtávání navštívených podniků, **hodnocení hvězdičkami**, datum návštěvy a poznámka
- Vyhledávání, filtry (vše / zbývá / hotovo) a filtrování podle kategorie
- Statistiky, export/import dat v JSON
- Responzivní design (Tailwind CSS přes CDN), funguje na mobilu i desktopu

## Spuštění

Stačí otevřít `index.html` v prohlížeči. Kvůli načítání skriptů je ale lepší statický server:

```bash
cd karolina-foodcourt
python -m http.server 8777
# → http://localhost:8777
```

## Struktura

| Soubor | Popis |
|---|---|
| `index.html` | Kostra aplikace, Tailwind config, SVG `<defs>` |
| `styles.css` | Doplňkové styly mapy (jednotky, popisky, zóna food courtu) |
| `app.js` | Logika — pan/zoom engine, vykreslování půdorysu i okolí, seznam, localStorage |
| `plan.js` | **Generovaný** půdorys: `FLOORS` (5 pater × jednotky) + `VENUES` (34 podniků) |
| `logos.js` | **Generovaná** loga podniků (inline SVG) |
| `tools/build-plan.js` | Generátor `plan.js` a `logos.js` ze zdrojových dat |

## Patra

| ID | Označení v datasetu | Jednotek | Sledovaných podniků |
|---|---|---|---|
| `p2` | `B1-P2` | 72 | 21 — **food court** |
| `p1` | `B1-P1` | 68 | 2 |
| `p0` | `B1-P0` | 86 | 6 |
| `m1` | `B1-P-1` | 12 | 2 |
| `m2` | `B1-P-2` | 24 | 3 |
## Zdroje dat

Půdorys i seznam podniků pocházejí z veřejných zdrojů obchodního centra:

1. **Seznam podniků + popisy** — WordPress REST API centra
   ```
   https://forumnovakarolina.cz/wp-json/wp/v2/obchody?per_page=100&kategorie_obchodu=133,134,135,136
   https://forumnovakarolina.cz/wp-json/wp/v2/kategorie_obchodu?per_page=100
   ```
2. **Půdorys, patra a obrysy jednotek** — mapový dataset VisioGlobe, který pohání oficiální
   mapu centra (`/mapa-centra/` → iframe `navigace-v-centru.cz/karolina/web`)
   ```
   https://mapserver.visioglobe.com/k19d1d6774c3496889970fb022d6e1cfdd08cf187/map.json
   https://navigace-v-centru.cz/karolina/js/data_core.min.js
   ```

### Regenerace `plan.js`

```bash
cd tools
curl -o vgmap.json https://mapserver.visioglobe.com/k19d1d6774c3496889970fb022d6e1cfdd08cf187/map.json
curl -o dc.js      https://navigace-v-centru.cz/karolina/js/data_core.min.js
node build-plan.js        # → ../plan.js, ../logos.js
```

Poznámky ke geometrii (ověřeno porovnáním s oficiální mapou):

- Souřadnice v `pois.polygons` jsou proti oficiální mapě otočené o **90° proti směru
  hodinových ručiček** → generátor je otáčí zpět (`ROT = Math.PI / 2`).
- `rotation_angle_in_degrees` z `geoinformation` se aplikovat **nesmí**.
- Osa Y se **neobrací** — souřadnice už jsou v SVG prostoru (y dolů).
- `data_core.min.js` obsahuje v názvech inline HTML/SVG — je nutné tagy odstranit.
  Pole `svg` u každé jednotky obsahuje logo, které se ukládá do `logos.js`.

## Uložená data

Klíč `localStorage`: **`fnk-foodcourt-v1`**

```json
{ "kfc": { "visited": true, "rating": 4, "date": "2025-03-12", "note": "..." } }
```

Tlačítko *Vymazat* v patičce smaže vše. Export/import je v menu ⋮ v hlavičce.

---

Neoficiální projekt, není nijak spojen s provozovatelem obchodního centra.
