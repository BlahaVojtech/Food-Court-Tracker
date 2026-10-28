/* ============================================================
   Food Court Tracker — Databázová vrstva bez přihlašování (db.js)
   Podporuje:
   - Výběr osoby: Vojta, Peťa, Adél + přidání nového jména a loga
   - Ukládání recenzí pro jednotlivé osoby do Supabase (Vercel) / localStorage
   - Statistiky a porovnávání návštěv mezi lidmi
   ============================================================ */
(() => {
  'use strict';

  // Výchozí členové
  const DEFAULT_MEMBERS = [
    { id: 'vojta', name: 'Vojta', color: '#2563eb', logo: '👑' },
    { id: 'peta',  name: 'Peťa',  color: '#e11d48', logo: '🍕' },
    { id: 'adel',  name: 'Adél',  color: '#9333ea', logo: '✨' }
  ];

  // Výchozí vzorové návštěvy pro okamžitý přehled v aplikaci
  const DEFAULT_REVIEWS = {
    'popeyes': {
      'vojta': { visited: true, rating: 5, note: 'Parádně křupavé a šťavnaté cajun kuře, nejlepší v Ostravě!', date: '2026-02-14' },
      'peta': { visited: true, rating: 4, note: 'Velká porce, hranolky super, ale trochu pálivější.', date: '2026-02-18' }
    },
    'coloseum': {
      'vojta': { visited: true, rating: 4, note: 'Dobrá pizza z pece a rychlá obsluha.', date: '2026-01-20' },
      'adel': { visited: true, rating: 5, note: 'Skvělé těstoviny a příjemné posezení.', date: '2026-02-05' }
    },
    'wafwaf': {
      'peta': { visited: true, rating: 5, note: 'Vafle s Nutellou a jahodami je naprosto geniální!', date: '2026-02-15' },
      'adel': { visited: true, rating: 5, note: 'Krásné prostředí a výborné lívance.', date: '2026-02-11' }
    },
    'bageterie': {
      'vojta': { visited: true, rating: 5, note: 'Bruselská bageta a patatas s tatarkou.', date: '2026-02-01' },
      'peta': { visited: true, rating: 4, note: 'Rychlé a čerstvé jídlo na oběd.', date: '2026-01-29' },
      'adel': { visited: true, rating: 4, note: 'Ledový čaj a lososová bageta.', date: '2026-02-10' }
    },
    'cokafe': {
      'vojta': { visited: true, rating: 5, note: 'Špičková výběrová káva v Organice.', date: '2026-02-26' },
      'adel': { visited: true, rating: 5, note: 'Ovesné cappuccino a kardamomový šnek!', date: '2026-02-20' }
    },
    'burgerking': {
      'vojta': { visited: true, rating: 4, note: 'Double Whopper grilovaný na ohni.', date: '2026-01-28' },
      'peta': { visited: true, rating: 5, note: 'Cibulové kroužky a burger bez chyby.', date: '2026-02-21' }
    },
    'ugosalaterie': {
      'adel': { visited: true, rating: 5, note: 'Můj nejoblíbenější lehký oběd, čerstvé saláty.', date: '2026-02-12' },
      'peta': { visited: true, rating: 4, note: 'Dýňová polévka byla výborná.', date: '2026-01-15' }
    },
    'tuktuk': {
      'vojta': { visited: true, rating: 4, note: 'Pad Thai s krevetami, poctivá porce.', date: '2026-01-15' },
      'peta': { visited: true, rating: 5, note: 'Červené kari je skvěle dochucené.', date: '2026-02-17' }
    },
    'loscapolitos': {
      'vojta': { visited: true, rating: 5, note: 'Burrito s trhaným hovězím a pálivou salsou.', date: '2026-02-22' }
    },
    'starbucks': {
      'adel': { visited: true, rating: 4, note: 'Karamelové frappuccino u vchodu.', date: '2026-02-04' }
    }
  };

  const MEMBERS_KEY = 'fnk_members_v2';
  const REVIEWS_KEY = 'fnk_reviews_v2';
  const ACTIVE_AUTHOR_KEY = 'fnk_active_author_v2';

  let supabaseClient = null;
  let isCloudActive = false;
  let members = [];
  let reviews = {}; // { [venueId]: { [authorId]: { visited, rating, note, date } } }
  let activeAuthorId = 'vojta';
  let listeners = [];

  const notifyChange = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

  function loadLocalState() {
    try {
      const storedM = localStorage.getItem(MEMBERS_KEY);
      members = storedM ? JSON.parse(storedM) : [...DEFAULT_MEMBERS];
    } catch {
      members = [...DEFAULT_MEMBERS];
    }

    try {
      const storedR = localStorage.getItem(REVIEWS_KEY);
      reviews = storedR ? JSON.parse(storedR) : JSON.parse(JSON.stringify(DEFAULT_REVIEWS));
    } catch {
      reviews = JSON.parse(JSON.stringify(DEFAULT_REVIEWS));
    }

    try {
      const act = localStorage.getItem(ACTIVE_AUTHOR_KEY);
      if (act && members.some(m => m.id === act)) activeAuthorId = act;
      else activeAuthorId = members[0] ? members[0].id : 'vojta';
    } catch {
      activeAuthorId = 'vojta';
    }
  }

  function saveLocalState() {
    try {
      localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
      localStorage.setItem(ACTIVE_AUTHOR_KEY, activeAuthorId);
    } catch (e) {
      console.warn('[DB] Nelze uložit do localStorage:', e);
    }
  }

  const DB = {
    isConfigured() {
      const cfg = window.APP_CONFIG || {};
      return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && cfg.supabaseUrl.startsWith('http'));
    },

    isCloud() {
      return isCloudActive;
    },

    async init() {
      loadLocalState();

      if (this.isConfigured() && window.supabase && typeof window.supabase.createClient === 'function') {
        try {
          const cfg = window.APP_CONFIG;
          supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

          // 1. Načteme členy z cloudu
          const { data: dbMembers, error: memErr } = await supabaseClient
            .from('members')
            .select('id, name, color, logo');

          if (!memErr && dbMembers && dbMembers.length) {
            // Sloučíme s výchozími
            const existingIds = new Set(dbMembers.map(m => m.id));
            const mergedMembers = [...dbMembers];
            DEFAULT_MEMBERS.forEach(def => {
              if (!existingIds.has(def.id)) mergedMembers.push(def);
            });
            members = mergedMembers;
          }

          // 2. Načteme recenze z cloudu
          const { data: dbReviews, error: revErr } = await supabaseClient
            .from('reviews')
            .select('venue_id, author_id, visited, rating, note, visit_date');

          if (!revErr && dbReviews) {
            const cloudReviews = {};
            dbReviews.forEach(r => {
              if (!cloudReviews[r.venue_id]) cloudReviews[r.venue_id] = {};
              cloudReviews[r.venue_id][r.author_id] = {
                visited: Boolean(r.visited),
                rating: Number(r.rating || 0),
                note: String(r.note || ''),
                date: r.visit_date || null
              };
            });
            reviews = cloudReviews;
          }

          isCloudActive = true;
          saveLocalState();
          notifyChange();
          return true;
        } catch (err) {
          console.warn('[DB] Supabase není dostupná, používám lokální data:', err);
          isCloudActive = false;
        }
      }

      isCloudActive = false;
      notifyChange();
      return false;
    },

    onChange(cb) {
      if (typeof cb === 'function') listeners.push(cb);
    },

    getMembers() {
      return members || [];
    },

    getMember(id) {
      return (members || []).find(m => m.id === id) || null;
    },

    getActiveAuthorId() {
      return activeAuthorId;
    },

    getActiveAuthor() {
      return this.getMember(activeAuthorId) || members[0] || null;
    },

    setActiveAuthorId(id) {
      if (members.some(m => m.id === id)) {
        activeAuthorId = id;
        saveLocalState();
        notifyChange();
      }
    },

    // Přidání nového jména a loga/avatara
    async addMember(name, color = '#3b8559', logo = '🍔') {
      name = (name || '').trim();
      if (!name) throw new Error('Zadejte jméno osoby.');

      const cleanId = name.toLowerCase().replace(/[^a-z0-9]/g, '') || ('person_' + Date.now());
      if (members.some(m => m.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('Osoba s tímto jménem již existuje.');
      }

      const newMember = {
        id: cleanId,
        name: name,
        color: color || '#3b8559',
        logo: (logo || '🍔').trim()
      };

      members.push(newMember);
      activeAuthorId = newMember.id;
      saveLocalState();

      if (isCloudActive && supabaseClient) {
        try {
          await supabaseClient.from('members').upsert(newMember);
        } catch (e) {
          console.warn('[DB] Nepodařilo se uložit člena do cloudu:', e);
        }
      }

      notifyChange();
      return newMember;
    },

    // Uložení recenze podniku pro vybranou osobu
    async saveReview(venueId, authorId, data) {
      if (!reviews[venueId]) reviews[venueId] = {};

      const rec = {
        visited: Boolean(data.visited),
        rating: Number(data.rating || 0),
        note: String(data.note || ''),
        date: data.date || null
      };

      reviews[venueId][authorId] = rec;
      saveLocalState();

      if (isCloudActive && supabaseClient) {
        try {
          await supabaseClient.from('reviews').upsert({
            venue_id: venueId,
            author_id: authorId,
            visited: rec.visited,
            rating: rec.rating,
            note: rec.note,
            visit_date: rec.date,
            updated_at: new Date().toISOString()
          }, { onConflict: 'venue_id, author_id' });
        } catch (e) {
          console.error('[DB] Chyba při ukládání recenze do Supabase:', e);
        }
      }

      notifyChange();
    },

    // Smazání recenze podniku pro danou osobu
    async deleteReview(venueId, authorId) {
      if (reviews[venueId] && reviews[venueId][authorId]) {
        delete reviews[venueId][authorId];
        saveLocalState();

        if (isCloudActive && supabaseClient) {
          try {
            await supabaseClient.from('reviews')
              .delete()
              .eq('venue_id', venueId)
              .eq('author_id', authorId);
          } catch (e) {
            console.error('[DB] Chyba při mazání recenze:', e);
          }
        }

        notifyChange();
      }
    },

    // Získání recenze konkrétního člověka
    getReview(venueId, authorId) {
      return (reviews[venueId] && reviews[venueId][authorId]) || null;
    },

    // Získání všech recenzí k danému podniku
    getVenueReviews(venueId) {
      const vReviews = reviews[venueId] || {};
      return Object.entries(vReviews).map(([authId, rev]) => {
        const mem = this.getMember(authId);
        return {
          authorId: authId,
          authorName: mem ? mem.name : authId,
          authorColor: mem ? mem.color : '#6b655d',
          authorLogo: mem ? mem.logo : '👤',
          visited: rev.visited,
          rating: rev.rating,
          note: rev.note,
          date: rev.date
        };
      });
    },

    // Statistiky podniku (kdo tam byl, průměrné hodnocení)
    getVenueStats(venueId) {
      const all = this.getVenueReviews(venueId);
      const visited = all.filter(r => r.visited);
      const rated = all.filter(r => r.rating > 0);
      const avg = rated.length ? +(rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1) : null;

      return {
        visitorCount: visited.length,
        ratingCount: rated.length,
        avgRating: avg,
        visitors: visited.map(r => ({
          id: r.authorId,
          name: r.authorName,
          color: r.authorColor,
          logo: r.authorLogo,
          rating: r.rating
        }))
      };
    },

    // Zjistit, zda daný člověk navštívil podnik
    isVisitedBy(venueId, authorId) {
      if (!authorId || authorId === 'all') {
        // Alespoň někdo navštívil
        const vr = reviews[venueId];
        return Boolean(vr && Object.values(vr).some(r => r.visited));
      }
      return Boolean(reviews[venueId] && reviews[venueId][authorId] && reviews[venueId][authorId].visited);
    },

    // Počet navštívených podniků danou osobou
    getVisitedCount(authorId) {
      let count = 0;
      Object.keys(reviews).forEach(vId => {
        if (this.isVisitedBy(vId, authorId)) count++;
      });
      return count;
    },

    // Celkové statistiky pro přehled
    getAllStats(allVenueIds) {
      const memberStats = members.map(m => {
        const visitedVenues = allVenueIds.filter(vId => this.isVisitedBy(vId, m.id));
        const ratedVenues = allVenueIds.filter(vId => {
          const r = this.getReview(vId, m.id);
          return r && r.rating > 0;
        });
        const avg = ratedVenues.length
          ? +(ratedVenues.reduce((s, vId) => s + this.getReview(vId, m.id).rating, 0) / ratedVenues.length).toFixed(1)
          : '–';

        return {
          member: m,
          visitedCount: visitedVenues.length,
          avgRating: avg
        };
      }).sort((a, b) => b.visitedCount - a.visitedCount);

      // Kde byli všichni
      const allMembers = members.map(m => m.id);
      const commonVenues = allVenueIds.filter(vId => {
        return allMembers.length > 0 && allMembers.every(mId => this.isVisitedBy(vId, mId));
      });

      // Kde nebyl ještě nikdo
      const unvisitedVenues = allVenueIds.filter(vId => !this.isVisitedBy(vId, 'all'));

      return {
        memberStats,
        commonVenues,
        unvisitedVenues
      };
    }
  };

  window.DB = DB;
})();
