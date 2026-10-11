/* ============================================================
   extra.js — Podniky v bezprostředním okolí centra
   Kanteen a Cokafe jsou přesně usazeny do půdorysu Organiky
   podle oficiálního architektonického plánu přízemí.
   ============================================================ */
const EXTRA = {
  floor: {
    id: 'out',
    name: 'V okolí centra',
    short: 'Okolí',
    outside: true,
    units: [
      {
        poi: "node/2859829408",
        d: "M1236 967H1296V1003H1236Z",
        k: "shop",
        n: "Frankie's Pub",
        lx: 1266,
        ly: 985,
        x: 1236,
        y: 967,
        w: 60,
        h: 36,
        a: 2160,
        v: "frankiespub",
        fc: 0
      },
      {
        poi: "node/11275613670",
        // Kanteen: jihozápadní lalok s lomenou vnitřní příčkou do kanceláří podle plánku
        d: "M668 1275 L708 1315 L735 1292 L754 1316 L730 1346 L712 1372 L734 1392 L770 1405 L730 1432 L698 1449 L680 1450 L658 1442 L644 1422 L642 1395 L648 1345 L658 1305 Z",
        k: "shop",
        n: "Kanteen Organica",
        lx: 686,
        ly: 1386,
        x: 642,
        y: 1275,
        w: 128,
        h: 175,
        a: 11200,
        v: "kanteen",
        fc: 0
      },
      {
        poi: "node/11275613669",
        // Cokafe: zachováno přesně podle stávajícího nastavení
        d: "M925 1248L858 1248A64 64 0 0 0 846 1225L875 1195L895 1205L940 1175L927 1223Z",
        k: "shop",
        n: "Cokafe",
        lx: 896,
        ly: 1218,
        x: 846,
        y: 1175,
        w: 94,
        h: 73,
        a: 4680,
        v: "cokafe",
        fc: 0
      }
    ]
  },
  venues: [
    {
      id: "frankiespub",
      poi: "node/2859829408",
      floor: "out",
      name: "Frankie's Pub",
      cat: "restaurant",
      desc: "Samostatný pavilon u centra — pivnice s širokým výčepem a jídlem po celý den.",
      tags: ["pivnice", "pivo", "samostatná budova"],
      fc: 0,
      open: "Po–Ne 11:00–21:00",
      web: "https://frankiespub.cz",
      osm: "node/2859829408"
    },
    {
      id: "kanteen",
      poi: "node/11275613670",
      floor: "out",
      name: "Kanteen Organica",
      cat: "restaurant",
      desc: "Velkokapacitní jídelna v jihozápadním křídle budovy Organica — snídaně a denně 9 hlavních jídel.",
      tags: ["jídelna", "denní menu", "Organica"],
      fc: 0,
      open: "Po–Pá 7:30–15:00",
      web: "https://www.kanteen.cz",
      osm: "node/11275613670"
    },
    {
      id: "cokafe",
      poi: "node/11275613669",
      floor: "out",
      name: "Cokafe",
      cat: "cafe",
      desc: "Výběrová kavárna ve východním křídle Organiky přímo u hlavního vstupu do atria.",
      tags: ["káva", "Organica", "terasa"],
      fc: 0,
      open: "Po–Pá 7:30–19:00 · So–Ne 8:30–19:00",
      web: null,
      osm: "node/11275613669"
    }
  ]
};