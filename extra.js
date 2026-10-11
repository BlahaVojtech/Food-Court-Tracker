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
           units: [{"poi":"node/2859829408","d":"M1236 967H1296V1003H1236Z","k":"shop","n":"Frankie's Pub","lx":1266,"ly":985,"x":1236,"y":967,"w":60,"h":36,"a":2160,"v":"frankiespub","fc":0},{"poi":"node/11275613670","d":"M616 1328L654 1301L713 1304L763 1320L804 1340L820 1365L804 1386L772 1406L733 1427L691 1448L652 1444L625 1427L614 1397L617 1361Z","k":"shop","n":"Kanteen Organica","lx":710,"ly":1373,"x":614,"y":1301,"w":206,"h":147,"a":13798,"v":"kanteen","fc":0},{"poi":"node/11275613669","d":"M842 1101L875 1087L916 1093L950 1116L974 1154L978 1192L966 1229L943 1258L910 1265L879 1249L860 1224L846 1198L831 1175L836 1138Z","k":"shop","n":"Cokafe","lx":905,"ly":1176,"x":831,"y":1087,"w":147,"h":178,"a":1408,"v":"cokafe","fc":0}] },
  venues: [{"id":"frankiespub","poi":"node/2859829408","floor":"out","name":"Frankie's Pub","cat":"restaurant","desc":"Samostatný pavilon u centra — pivnice s širokým výčepem a jídlem po celý den.","tags":["pivnice","pivo","samostatná budova"],"fc":0,"open":"Po–Ne 11:00–21:00","web":"https://frankiespub.cz","osm":"node/2859829408"},{"id":"kanteen","poi":"node/11275613670","floor":"out","name":"Kanteen Organica","cat":"restaurant","desc":"Velkokapacitní jídelna v budově Organica — snídaně a denně 9 hlavních jídel.","tags":["jídelna","denní menu","Organica"],"fc":0,"open":"Po–Pá 7:30–15:00","web":"https://www.kanteen.cz","osm":"node/11275613670"},{"id":"cokafe","poi":"node/11275613669","floor":"out","name":"Cokafe","cat":"cafe","desc":"Kavárna u Kanteenu v Organice, venkovní posezení a wi-fi.","tags":["káva","Organica","terasa"],"fc":0,"open":"Po–Pá 7:30–19:00 · So–Ne 8:30–19:00","web":null,"osm":"node/11275613669"}]
};
