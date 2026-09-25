/* ============================================================
   extra.js — AUTOMATICKY GENEROVÁNO, needituj ručně.
   Vygeneruj znovu:  node tools/build-extra.js

   Podniky v bezprostředním okolí centra, které nejsou v oficiálním
   půdorysu Forum Nová Karolina. Poloha podle OpenStreetMap,
   promítnuto do stejného rámce (sever nahoře, 1 jednotka = 0,25 m).
   Tato vrstva je viditelná nad všemi patry.
   ============================================================ */
const EXTRA = {
  floor: { id: 'out', name: 'V okolí centra', short: 'Okolí', outside: true,
           units: [{"poi":"node/2859829408","d":"M1236 967H1296V1003H1236Z","k":"shop","n":"Frankie's Pub","lx":1266,"ly":985,"x":1236,"y":967,"w":60,"h":36,"a":2160,"v":"frankiespub","fc":0},{"poi":"node/11275613670","d":"M819 1323H923V1383H819Z","k":"shop","n":"Kanteen Organica","lx":871,"ly":1353,"x":819,"y":1323,"w":104,"h":60,"a":6240,"v":"kanteen","fc":0},{"poi":"node/11275613669","d":"M871 1203H915V1235H871Z","k":"shop","n":"Cokafe","lx":893,"ly":1219,"x":871,"y":1203,"w":44,"h":32,"a":1408,"v":"cokafe","fc":0}] },
  venues: [{"id":"frankiespub","poi":"node/2859829408","floor":"out","name":"Frankie's Pub","cat":"restaurant","desc":"Samostatný pavilon u centra — pivnice s širokým výčepem a jídlem po celý den.","tags":["pivnice","pivo","samostatná budova"],"fc":0,"open":"Po–Ne 11:00–21:00","web":"https://frankiespub.cz","osm":"node/2859829408"},{"id":"kanteen","poi":"node/11275613670","floor":"out","name":"Kanteen Organica","cat":"restaurant","desc":"Velkokapacitní jídelna v budově Organica — snídaně a denně 9 hlavních jídel.","tags":["jídelna","denní menu","Organica"],"fc":0,"open":"Po–Pá 7:30–15:00","web":"https://www.kanteen.cz","osm":"node/11275613670"},{"id":"cokafe","poi":"node/11275613669","floor":"out","name":"Cokafe","cat":"cafe","desc":"Kavárna u Kanteenu v Organice, venkovní posezení a wi-fi.","tags":["káva","Organica","terasa"],"fc":0,"open":"Po–Pá 7:30–19:00 · So–Ne 8:30–19:00","web":null,"osm":"node/11275613669"}]
};
