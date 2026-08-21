/* Keter PWA — generato dal file JSX dell'artifact. React, ReactDOM e le icone
   sono caricati come globali da index.html (nessun bundler). */
const { useState, useMemo, useEffect, useCallback, useRef } = React;
const { Search, X, Crown, Tag: TagIcon, ChevronRight, Edit3, Save, RotateCcw, BookOpen, Library, Link2, Plus, Download, Upload, Feather, PenLine, FileUp } = window.KeterIcons;

// ---------- Normalizzazione ebraica (niqqud + lettere finali) ----------
const HEB_FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const NIQQUD_RE = /[\u0591-\u05C7]/;

// Normalizza mantenendo la mappa: indice normalizzato -> indice originale.
// Serve per estrarre snippet dal testo originale (con niqqud) a partire
// da una corrispondenza trovata sul testo normalizzato.
function normalizeHebrewWithMap(s) {
  const src = s || '';
  let norm = '';
  const map = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (NIQQUD_RE.test(ch)) continue;
    norm += (HEB_FINALS[ch] || ch).toLowerCase();
    map.push(i);
  }
  return { norm, map };
}

function normalizeHebrew(s) {
  return normalizeHebrewWithMap(s).norm;
}

// ---------- Versione (visibile nel pannello di pubblicazione) ----------
// Incrementare a ogni deploy per verificare che il sito serva il file nuovo.
const KETER_VERSION = 33;

// ---------- Pubblicazione su GitHub ----------
const GH_OWNER = 'pciccardini-lang';
const GH_REPO = 'keter';
const GH_FILE = 'modifiche.json';
const GH_BRANCH = 'main';

// Base64 <-> UTF-8 (necessario per l'ebraico nei contenuti dell'API GitHub)
function b64EncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64DecodeUtf8(b64) {
  const bin = atob((b64 || '').replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// Applica una mappa di modifiche { id: voce } a una lista di voci:
// aggiorna quelle esistenti e AGGIUNGE quelle nuove (create dall'app).
function applyEditsToEntries(base, editsMap) {
  if (!editsMap || typeof editsMap !== 'object') return base;
  const next = base.map((e) => (editsMap[e.id] ? { ...e, ...editsMap[e.id] } : e));
  const existingIds = new Set(base.map((e) => String(e.id)));
  Object.values(editsMap).forEach((e) => {
    if (e && e.id !== undefined && !existingIds.has(String(e.id))) next.push(e);
  });
  return next;
}

// Fonde una lista di testi in una lista base: aggiorna per id, aggiunge i nuovi.
function mergeTextsList(base, list) {
  if (!Array.isArray(list) || !list.length) return base;
  const ids = new Set(base.map((t) => t.id));
  const updated = base.map((t) => {
    const found = list.find((x) => x && x.id === t.id);
    return found ? { ...t, ...found } : t;
  });
  return updated.concat(list.filter((x) => x && x.id !== undefined && !ids.has(x.id)));
}

// ---------- Eliminazioni (tombstone) ----------
// Le eliminazioni vengono registrate per id in { lessico, testi, articoli },
// così valgono anche per gli elementi seed e sopravvivono alla pubblicazione.
function normalizeDeletes(d) {
  return {
    lessico: Array.isArray(d && d.lessico) ? d.lessico : [],
    testi: Array.isArray(d && d.testi) ? d.testi : [],
    articoli: Array.isArray(d && d.articoli) ? d.articoli : [],
  };
}

function unionIds(a, b) {
  const seen = new Set(a.map(String));
  return [...a, ...b.filter((id) => !seen.has(String(id)))];
}

function addUniqueId(list, id) {
  return list.some((x) => String(x) === String(id)) ? list : [...list, id];
}

function removeIdFrom(list, id) {
  return list.filter((x) => String(x) !== String(id));
}

// Timestamp di inserimento di una voce, ricavato dall'id ('v-<millisecondi>').
// Le voci del lessico di base non ce l'hanno: restano dopo, nell'ordine originale.
function entryInsertTime(e) {
  const m = /^v-(\d+)$/.exec(e && e.id != null ? String(e.id) : '');
  return m ? Number(m[1]) : 0;
}

function filterDeleted(list, ids) {
  if (!ids || !ids.length) return list;
  const set = new Set(ids.map(String));
  return list.filter((x) => !set.has(String(x.id)));
}

const KETER_DATA = window.KETER_DATA;


const HEBREW_RE = /[\u0590-\u05FF]/;
const isHebrewText = (s) => s && HEBREW_RE.test(s);

const FIELD_LABELS = {
  Parola: 'Parola',
  Traduzione: 'Traduzione',
  Definizione: 'Definizione',
  Coniugazione: 'Coniugazione',
  Declinazioni: 'Declinazioni',
  Esempi: 'Esempi',
  Citazione: 'Citazione (Shabtai)',
  Tag: 'Tag',
};

const DETAIL_FIELDS = ['Definizione', 'Coniugazione', 'Declinazioni', 'Esempi', 'Citazione'];

const TEXTS_SEED = window.TEXTS_SEED;

const ARTICLES_SEED = window.ARTICLES_SEED;

function FieldText({ text }) {
  if (!text) return null;
  const heb = isHebrewText(text);
  return (
    <div
      dir={heb ? 'rtl' : 'ltr'}
      style={{
        fontFamily: heb ? "'Frank Ruhl Libre', 'David Libre', serif" : "'Cormorant Garamond', Georgia, serif",
        whiteSpace: 'pre-wrap',
        lineHeight: 1.6,
        textAlign: heb ? undefined : 'center',
      }}
    >
      {text}
    </div>
  );
}

function Keter() {
  const [view, setView] = useState('lexicon');
  const [entries, setEntries] = useState(KETER_DATA);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('all');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [sessionEdits, setSessionEdits] = useState({});
  const [editsPanel, setEditsPanel] = useState(null); // null | 'export' | 'import'
  const [editsImportText, setEditsImportText] = useState('');
  const [editsImportError, setEditsImportError] = useState('');
  const [editsCopied, setEditsCopied] = useState(false);
  const [publishState, setPublishState] = useState('idle'); // idle | publishing | published | error
  const [publishError, setPublishError] = useState('');

  const [articles, setArticles] = useState(ARTICLES_SEED);
  const [sessionArticles, setSessionArticles] = useState({});
  const [sessionDeletes, setSessionDeletes] = useState({ lessico: [], testi: [], articoli: [] });
  const [articleQuery, setArticleQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [editingArticle, setEditingArticle] = useState(false);
  const [articleDraft, setArticleDraft] = useState(null);
  const [articleSaveState, setArticleSaveState] = useState('idle');
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  const [texts, setTexts] = useState(TEXTS_SEED);
  const [textQuery, setTextQuery] = useState('');
  const [selectedText, setSelectedText] = useState(null);
  const [editingText, setEditingText] = useState(false);
  const [textDraft, setTextDraft] = useState(null);
  const [textSaveState, setTextSaveState] = useState('idle');
  const [sessionTexts, setSessionTexts] = useState({});
  const [wordLookup, setWordLookup] = useState(null); // { raw, word, matches }
  const [pdfState, setPdfState] = useState('idle'); // idle | loading | error | notice
  const [pdfError, setPdfError] = useState('');
  const pdfInputRef = useRef(null);
  const [visibleParas, setVisibleParas] = useState(25);
  const [readerSearchOpen, setReaderSearchOpen] = useState(false);
  const [readerQuery, setReaderQuery] = useState('');

  // Caricamento iniziale: modifiche pubblicate (modifiche.json su GitHub Pages)
  // + salvataggi locali del dispositivo, in quest'ordine (le locali vincono).
  useEffect(() => {
    (async () => {
      // 1. modifiche pubblicate (il file può non esistere ancora: nessun problema)
      let published = null;
      try {
        const resp = await fetch('./' + GH_FILE + '?v=' + Date.now(), { cache: 'no-store' });
        if (resp.ok) published = await resp.json();
      } catch (err) {
        // offline, o file non ancora creato
      }
      // 2. modifiche locali del dispositivo
      let localEdits = {};
      try {
        const r = await window.storage.get('keter-edits', false);
        if (r && r.value) localEdits = JSON.parse(r.value);
      } catch (err) {
        localEdits = {};
      }
      let localTexts = null;
      try {
        const r = await window.storage.get('keter-texts', false);
        if (r && r.value) localTexts = JSON.parse(r.value);
      } catch (err) {
        localTexts = null;
      }
      // 2b. eliminazioni: pubblicate + locali del dispositivo
      let localDeletes = normalizeDeletes(null);
      try {
        const r = await window.storage.get('keter-deletes', false);
        if (r && r.value) localDeletes = normalizeDeletes(JSON.parse(r.value));
      } catch (err) {
        localDeletes = normalizeDeletes(null);
      }
      const pubDeletes = normalizeDeletes(published && published.eliminati);
      const del = {
        lessico: unionIds(pubDeletes.lessico, localDeletes.lessico),
        testi: unionIds(pubDeletes.testi, localDeletes.testi),
        articoli: unionIds(pubDeletes.articoli, localDeletes.articoli),
      };
      // 3. lessico: dati base -> pubblicate -> locali -> eliminazioni
      setEntries((base) => {
        let next = base;
        if (published && published.lessico) next = applyEditsToEntries(next, published.lessico);
        if (localEdits && Object.keys(localEdits).length) next = applyEditsToEntries(next, localEdits);
        return filterDeleted(next, del.lessico);
      });
      // 4. testi: seed -> pubblicati -> locali -> eliminazioni
      setTexts(() => {
        let next = TEXTS_SEED;
        if (published && Array.isArray(published.testi)) next = mergeTextsList(next, published.testi);
        if (Array.isArray(localTexts)) next = mergeTextsList(next, localTexts);
        return filterDeleted(next, del.testi);
      });
      // 5. articoli: seed -> pubblicati -> locali -> eliminazioni
      let localArticles = null;
      try {
        const r = await window.storage.get('keter-articles', false);
        if (r && r.value) localArticles = JSON.parse(r.value);
      } catch (err) {
        localArticles = null;
      }
      setArticles(() => {
        let next = ARTICLES_SEED;
        if (published && Array.isArray(published.articoli)) next = mergeTextsList(next, published.articoli);
        if (Array.isArray(localArticles)) next = mergeTextsList(next, localArticles);
        return filterDeleted(next, del.articoli);
      });
      setLoaded(true);
    })();
  }, []);

  const tags = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      if (e.Tag) set.add(e.Tag.trim());
    });
    return Array.from(set).sort();
  }, [entries]);

  const tagColor = useCallback((tag) => {
    if (!tag) return '#8a8a8a';
    const palette = ['#e8b62a', '#8fae7d', '#a3714f', '#7b8fae', '#b06a8f', '#c98f4b'];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }, []);

  const filtered = useMemo(() => {
    let list = entries;
    if (activeTag !== 'all') {
      list = list.filter((e) => (e.Tag || '').trim() === activeTag);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const qh = q.replace(/[\u0591-\u05C7]/g, '');
      list = list.filter((e) => {
        const parola = (e.Parola || '').toLowerCase();
        const parolaNoNiqqud = parola.replace(/[\u0591-\u05C7]/g, '');
        const trad = (e.Traduzione || '').toLowerCase();
        return parola.includes(q) || parolaNoNiqqud.includes(qh) || trad.includes(q);
      });
    }
    // Ordine cronologico inverso: le voci inserite più di recente per prime,
    // poi il lessico di base nel suo ordine originale (sort stabile).
    return list.slice().sort((a, b) => entryInsertTime(b) - entryInsertTime(a));
  }, [entries, query, activeTag]);

  const openEntry = (e) => {
    setSelected(e);
    setEditing(false);
    setDraft(e);
  };

  const closeModal = () => {
    setSelected(null);
    setEditing(false);
    setDraft(null);
  };

  const startEdit = () => {
    setDraft({ ...selected });
    setEditing(true);
  };

  // Crea una voce nuova del Lessico, aperta direttamente in modifica.
  const newEntry = () => {
    const draft = {
      id: 'v-' + Date.now(),
      Parola: '',
      Traduzione: '',
      Definizione: '',
      Coniugazione: '',
      Declinazioni: '',
      Esempi: '',
      Citazione: '',
      Tag: '',
    };
    setSelected(draft);
    setDraft(draft);
    setEditing(true);
  };

  const saveEdit = async () => {
    const saved = { ...draft };
    if (!(saved.Parola || '').trim() && !(saved.Traduzione || '').trim()) {
      window.alert('Inserisci almeno la parola o la traduzione prima di salvare.');
      return;
    }
    // 1. Applica SEMPRE la modifica allo stato locale, subito.
    //    Se la voce è nuova, viene aggiunta alla lista.
    setEntries((base) =>
      base.some((e) => e.id === saved.id)
        ? base.map((e) => (e.id === saved.id ? saved : e))
        : [...base, saved]
    );
    setSelected(saved);
    setSessionEdits((prev) => ({ ...prev, [saved.id]: saved }));
    unrecordDelete('lessico', saved.id);
    setEditing(false);
    setSaveState('saving');

    // 2. Prova window.storage in background (best-effort).
    let persisted = false;
    try {
      let existing = {};
      try {
        const r = await window.storage.get('keter-edits', false);
        if (r && r.value) existing = JSON.parse(r.value);
      } catch (err) {
        existing = {};
      }
      existing[saved.id] = saved;
      const res = await window.storage.set('keter-edits', JSON.stringify(existing), false);
      persisted = !!res;
    } catch (err) {
      persisted = false;
    }

    setSaveState(persisted ? 'saved' : 'saved-local');
    setTimeout(() => setSaveState('idle'), 2000);
  };

  // ---------- Eliminazione ----------

  // Registra un'eliminazione (sessione + storage locale best-effort).
  const recordDelete = async (kind, id) => {
    setSessionDeletes((prev) => ({ ...prev, [kind]: addUniqueId(prev[kind], id) }));
    try {
      let stored = normalizeDeletes(null);
      try {
        const r = await window.storage.get('keter-deletes', false);
        if (r && r.value) stored = normalizeDeletes(JSON.parse(r.value));
      } catch (e) {}
      stored[kind] = addUniqueId(stored[kind], id);
      await window.storage.set('keter-deletes', JSON.stringify(stored), false);
    } catch (err) {
      // resta comunque registrata in sessione
    }
  };

  // Rimuove un'eliminazione (quando un elemento con lo stesso id viene risalvato).
  const unrecordDelete = async (kind, id) => {
    setSessionDeletes((prev) => ({ ...prev, [kind]: removeIdFrom(prev[kind], id) }));
    try {
      let stored = normalizeDeletes(null);
      try {
        const r = await window.storage.get('keter-deletes', false);
        if (r && r.value) stored = normalizeDeletes(JSON.parse(r.value));
      } catch (e) {}
      stored[kind] = removeIdFrom(stored[kind], id);
      await window.storage.set('keter-deletes', JSON.stringify(stored), false);
    } catch (err) {}
  };

  const deleteEntry = async () => {
    if (!selected) return;
    if (!window.confirm('Eliminare questa voce dal Lessico? Con la prossima pubblicazione sparirà anche dagli altri dispositivi.')) return;
    const id = selected.id;
    setEntries((base) => base.filter((e) => e.id !== id));
    setSessionEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    closeModal();
    recordDelete('lessico', id);
    // togli anche dalle modifiche locali salvate, se presente
    try {
      let existing = {};
      try {
        const r = await window.storage.get('keter-edits', false);
        if (r && r.value) existing = JSON.parse(r.value);
      } catch (e) {}
      if (existing[id] !== undefined) {
        delete existing[id];
        await window.storage.set('keter-edits', JSON.stringify(existing), false);
      }
    } catch (err) {}
  };

  const deleteText = async () => {
    if (!selectedText) return;
    if (!window.confirm('Eliminare questo testo? Con la prossima pubblicazione sparirà anche dagli altri dispositivi.')) return;
    const id = selectedText.id;
    const updated = texts.filter((t) => t.id !== id);
    setTexts(updated);
    setSessionTexts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    closeTextModal();
    recordDelete('testi', id);
    try {
      await window.storage.set('keter-texts', JSON.stringify(updated), false);
    } catch (err) {}
  };

  const deleteArticle = async () => {
    if (!selectedArticle) return;
    if (!window.confirm('Eliminare questo articolo? Con la prossima pubblicazione sparirà anche dagli altri dispositivi.')) return;
    const id = selectedArticle.id;
    const updated = articles.filter((a) => a.id !== id);
    setArticles(updated);
    setSessionArticles((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    closeArticleModal();
    recordDelete('articoli', id);
    try {
      await window.storage.set('keter-articles', JSON.stringify(updated), false);
    } catch (err) {}
  };

  const applyEditsMap = (edits) => {
    setEntries((base) => applyEditsToEntries(base, edits));
    setSessionEdits((prev) => ({ ...prev, ...edits }));
  };

  const applyTextsList = (list) => {
    setTexts((base) => mergeTextsList(base, list));
    setSessionTexts((prev) => {
      const next = { ...prev };
      list.forEach((t) => {
        if (t && t.id !== undefined) next[t.id] = t;
      });
      return next;
    });
  };

  const submitEditsImport = () => {
    setEditsImportError('');
    try {
      const parsed = JSON.parse(editsImportText);
      let map = {};
      let textsList = [];
      let articlesList = [];
      let delList = normalizeDeletes(null);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && (parsed.lessico || parsed.testi || parsed.articoli || parsed.eliminati)) {
        // nuovo formato: { lessico: {...}, testi: [...], articoli: [...], eliminati: {...} }
        map = parsed.lessico || {};
        textsList = Array.isArray(parsed.testi) ? parsed.testi : [];
        articlesList = Array.isArray(parsed.articoli) ? parsed.articoli : [];
        delList = normalizeDeletes(parsed.eliminati);
      } else if (Array.isArray(parsed)) {
        parsed.forEach((e) => {
          if (e && e.id !== undefined) map[e.id] = e;
        });
      } else if (parsed && typeof parsed === 'object') {
        map = parsed;
      } else {
        throw new Error('formato non valido');
      }
      const nDel = delList.lessico.length + delList.testi.length + delList.articoli.length;
      const n = Object.keys(map).length + textsList.length + articlesList.length + nDel;
      if (!n) throw new Error('nessuna modifica trovata');
      if (Object.keys(map).length) applyEditsMap(map);
      if (textsList.length) applyTextsList(textsList);
      if (articlesList.length) {
        setArticles((base) => mergeTextsList(base, articlesList));
        setSessionArticles((prev) => {
          const next = { ...prev };
          articlesList.forEach((a) => { if (a && a.id !== undefined) next[a.id] = a; });
          return next;
        });
      }
      if (nDel) {
        setEntries((base) => filterDeleted(base, delList.lessico));
        setTexts((base) => filterDeleted(base, delList.testi));
        setArticles((base) => filterDeleted(base, delList.articoli));
        setSessionDeletes((prev) => ({
          lessico: unionIds(prev.lessico, delList.lessico),
          testi: unionIds(prev.testi, delList.testi),
          articoli: unionIds(prev.articoli, delList.articoli),
        }));
      }
      setEditsImportText('');
      setEditsPanel(null);
    } catch (err) {
      setEditsImportError('JSON non valido: ' + err.message);
    }
  };

  const copyEditsJson = async () => {
    const json = JSON.stringify(exportPayload, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setEditsCopied(true);
      setTimeout(() => setEditsCopied(false), 2000);
    } catch (err) {
      // fallback: l'utente può selezionare e copiare dal textarea
    }
  };

  // ---------- Pubblicazione su GitHub ----------

  // Recupera (o chiede) il token personale GitHub, salvato solo sul dispositivo.
  const getGithubToken = (forceAsk = false) => {
    let token = '';
    try { token = localStorage.getItem('keter-github-token') || ''; } catch (e) {}
    if (!token || forceAsk) {
      token = (window.prompt(
        "Per pubblicare serve un token personale GitHub (fine-grained) con permesso Contents: Read and write sul repository keter.\nSi crea su github.com \u2192 Settings \u2192 Developer settings \u2192 Personal access tokens.\nVerr\u00e0 salvato solo su questo dispositivo."
      ) || '').trim();
      if (token) { try { localStorage.setItem('keter-github-token', token); } catch (e) {} }
    }
    return token;
  };

  // Pubblica le modifiche in sospeso nel file modifiche.json del repository.
  // Il file viene creato automaticamente alla prima pubblicazione.
  const publishToGithub = async () => {
    if (!pendingCount) return;
    const token = getGithubToken();
    if (!token) return;
    setPublishState('publishing');
    setPublishError('');
    try {
      const apiUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}`;
      const headers = {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
      };
      // 1. Legge la versione corrente del file (sha + contenuto), se esiste.
      let sha = null;
      let remote = { lessico: {}, testi: [], articoli: [], eliminati: normalizeDeletes(null) };
      const getResp = await fetch(apiUrl + '?ref=' + GH_BRANCH + '&t=' + Date.now(), { headers });
      if (getResp.status === 200) {
        const info = await getResp.json();
        sha = info.sha;
        try {
          const parsed = JSON.parse(b64DecodeUtf8(info.content));
          if (parsed && typeof parsed === 'object') {
            remote.lessico = parsed.lessico || {};
            remote.testi = Array.isArray(parsed.testi) ? parsed.testi : [];
            remote.articoli = Array.isArray(parsed.articoli) ? parsed.articoli : [];
            remote.eliminati = normalizeDeletes(parsed.eliminati);
          }
        } catch (e) {
          // contenuto illeggibile: verrà riscritto da zero
        }
      } else if (getResp.status === 401 || getResp.status === 403) {
        try { localStorage.removeItem('keter-github-token'); } catch (e) {}
        throw new Error('token non valido o scaduto — riprova e ti verrà richiesto di nuovo');
      } else if (getResp.status !== 404) {
        throw new Error('lettura da GitHub fallita (HTTP ' + getResp.status + ')');
      }
      // 2. Fonde le modifiche remote già pubblicate con quelle locali in sospeso.
      const mergedLessico = { ...remote.lessico, ...sessionEdits };
      const textMap = new Map(remote.testi.filter((t) => t && t.id !== undefined).map((t) => [t.id, t]));
      Object.values(sessionTexts).forEach((t) => { if (t && t.id !== undefined) textMap.set(t.id, t); });
      const articleMap = new Map(remote.articoli.filter((a) => a && a.id !== undefined).map((a) => [a.id, a]));
      Object.values(sessionArticles).forEach((a) => { if (a && a.id !== undefined) articleMap.set(a.id, a); });
      // Eliminazioni: unione remoto + sessione; un id risalvato in sessione
      // non deve restare tra gli eliminati (l'ultima azione vince).
      const mergedDeletes = {
        lessico: unionIds(remote.eliminati.lessico, sessionDeletes.lessico),
        testi: unionIds(remote.eliminati.testi, sessionDeletes.testi),
        articoli: unionIds(remote.eliminati.articoli, sessionDeletes.articoli),
      };
      Object.keys(sessionEdits).forEach((id) => { mergedDeletes.lessico = removeIdFrom(mergedDeletes.lessico, id); });
      Object.keys(sessionTexts).forEach((id) => { mergedDeletes.testi = removeIdFrom(mergedDeletes.testi, id); });
      Object.keys(sessionArticles).forEach((id) => { mergedDeletes.articoli = removeIdFrom(mergedDeletes.articoli, id); });
      // Coerenza del file: un id eliminato non deve comparire anche nei contenuti.
      mergedDeletes.lessico.forEach((id) => { delete mergedLessico[id]; });
      const merged = {
        lessico: mergedLessico,
        testi: filterDeleted(Array.from(textMap.values()), mergedDeletes.testi),
        articoli: filterDeleted(Array.from(articleMap.values()), mergedDeletes.articoli),
        eliminati: mergedDeletes,
      };
      // 3. Scrive il file aggiornato (lo crea se non esiste).
      const putResp = await fetch(apiUrl, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Keter: pubblicazione modifiche dall\u2019app',
          content: b64EncodeUtf8(JSON.stringify(merged, null, 2)),
          branch: GH_BRANCH,
          ...(sha ? { sha } : {}),
        }),
      });
      if (!putResp.ok) {
        if (putResp.status === 401 || putResp.status === 403) {
          try { localStorage.removeItem('keter-github-token'); } catch (e) {}
          throw new Error('token non valido o senza permessi di scrittura — riprova e ti verrà richiesto di nuovo');
        }
        if (putResp.status === 409) throw new Error('conflitto di versione: riprova tra qualche secondo');
        throw new Error('scrittura su GitHub fallita (HTTP ' + putResp.status + ')');
      }
      setSessionEdits({});
      setSessionTexts({});
      setSessionArticles({});
      setSessionDeletes({ lessico: [], testi: [], articoli: [] });
      setPublishState('published');
      setTimeout(() => setPublishState('idle'), 5000);
    } catch (err) {
      setPublishState('error');
      setPublishError(err.message || 'errore sconosciuto');
    }
  };

  // ---------- Testi Agnon / Shabtai ----------

  const stripNiqqud = useCallback((s) => (s || '').replace(/[\u0591-\u05C7]/g, ''), []);
  const cleanHebrewWord = useCallback(
    (s) => stripNiqqud(s).replace(/[^\u05D0-\u05EA]/g, ''),
    [stripNiqqud]
  );

  // Indice: token ebraico normalizzato -> voci del lessico
  const hebrewIndex = useMemo(() => {
    const map = new Map();
    entries.forEach((e) => {
      const tokens = stripNiqqud(e.Parola || '')
        .split(/[^\u05D0-\u05EA]+/)
        .filter((t) => t.length > 1);
      tokens.forEach((t) => {
        if (!map.has(t)) map.set(t, []);
        map.get(t).push(e);
      });
    });
    return map;
  }, [entries, stripNiqqud]);

  const lookupWord = useCallback(
    (raw) => {
      const w = cleanHebrewWord(raw);
      if (!w || w.length < 2) return;
      const seen = new Set();
      const matches = [];
      const push = (list) => {
        (list || []).forEach((e) => {
          if (!seen.has(e.id) && matches.length < 12) {
            seen.add(e.id);
            matches.push(e);
          }
        });
      };
      // 1. corrispondenza esatta
      push(hebrewIndex.get(w));
      // 2. spoglio dei prefissi comuni (ו, ה, ב, ל, כ, מ, ש, anche doppi)
      const prefixChars = 'והבלכמש';
      const variants = [];
      if (w.length > 2 && prefixChars.includes(w[0])) {
        variants.push(w.slice(1));
        if (w.length > 3 && prefixChars.includes(w[1])) variants.push(w.slice(2));
      }
      variants.forEach((v) => push(hebrewIndex.get(v)));
      // 3. ricerca per inclusione (solo se ancora niente)
      if (matches.length === 0) {
        for (const e of entries) {
          const p = stripNiqqud(e.Parola || '');
          if (p.includes(w) || variants.some((v) => v.length > 2 && p.includes(v))) {
            push([e]);
            if (matches.length >= 12) break;
          }
        }
      }
      setWordLookup({ raw, word: w, matches });
    },
    [cleanHebrewWord, hebrewIndex, entries, stripNiqqud]
  );

  // Corpi dei testi normalizzati una volta sola (non ad ogni tasto)
  const textBodiesIndex = useMemo(() => {
    const m = new Map();
    texts.forEach((t) => m.set(t.id, normalizeHebrewWithMap(t.body || '')));
    return m;
  }, [texts]);

  const { list: filteredTexts, matches: textMatches } = useMemo(() => {
    const author = view === 'agnon' || view === 'shabtai' ? view : null;
    if (!author) return { list: [], matches: new Map() };
    let list = texts.filter((t) => t.author === author);
    const matches = new Map();
    const raw = textQuery.trim();
    if (raw) {
      const q = raw.toLowerCase();
      const qNorm = normalizeHebrew(raw);
      list = list.filter((t) => {
        const metaHit =
          (t.title || '').toLowerCase().includes(q) ||
          (t.source || '').toLowerCase().includes(q) ||
          (t.tags || '').toLowerCase().includes(q) ||
          (t.translation || '').toLowerCase().includes(q) ||
          (t.notes || '').toLowerCase().includes(q);

        let bodyHit = false;
        if (qNorm) {
          const idx = textBodiesIndex.get(t.id) || normalizeHebrewWithMap(t.body || '');
          let pos = idx.norm.indexOf(qNorm);
          if (pos !== -1) {
            bodyHit = true;
            // conteggio occorrenze
            let count = 0;
            let p = pos;
            while (p !== -1) {
              count++;
              p = idx.norm.indexOf(qNorm, p + qNorm.length);
            }
            // snippet dal testo ORIGINALE (con niqqud) attorno alla prima occorrenza
            const body = t.body || '';
            const mStart = idx.map[pos];
            const lastNormIdx = pos + qNorm.length - 1;
            let mEnd = lastNormIdx < idx.map.length ? idx.map[lastNormIdx] + 1 : body.length;
            // includi eventuale niqqud che segue l'ultima lettera del match
            while (mEnd < body.length && NIQQUD_RE.test(body[mEnd])) mEnd++;
            const CONTEXT = 45;
            const lineStart = body.lastIndexOf('\n', mStart) + 1;
            let lineEnd = body.indexOf('\n', mEnd);
            if (lineEnd === -1) lineEnd = body.length;
            let s0 = Math.max(lineStart, mStart - CONTEXT);
            let s1 = Math.min(lineEnd, mEnd + CONTEXT);
            // allinea ai confini di parola
            if (s0 > lineStart) {
              const sp = body.indexOf(' ', s0);
              if (sp !== -1 && sp < mStart) s0 = sp + 1;
            }
            if (s1 < lineEnd) {
              const sp = body.lastIndexOf(' ', s1);
              if (sp > mEnd) s1 = sp;
            }
            matches.set(t.id, {
              count,
              before: (s0 > lineStart ? '…' : '') + body.slice(s0, mStart),
              hit: body.slice(mStart, mEnd),
              after: body.slice(mEnd, s1) + (s1 < lineEnd ? '…' : ''),
            });
          }
        }
        return metaHit || bodyHit;
      });
    }
    return { list, matches };
  }, [texts, textQuery, view, textBodiesIndex]);

  const exportPayload = useMemo(
    () => ({
      lessico: sessionEdits,
      testi: Object.values(sessionTexts),
      articoli: Object.values(sessionArticles),
      eliminati: sessionDeletes,
    }),
    [sessionEdits, sessionTexts, sessionArticles, sessionDeletes]
  );
  const pendingCount =
    Object.keys(sessionEdits).length +
    Object.keys(sessionTexts).length +
    Object.keys(sessionArticles).length +
    sessionDeletes.lessico.length +
    sessionDeletes.testi.length +
    sessionDeletes.articoli.length;

  const openText = (t, withQuery = '') => {
    setSelectedText(t);
    setEditingText(false);
    setTextDraft(t);
    setVisibleParas(25);
    if (withQuery) {
      // La ricerca della lista ha trovato la query nel corpo:
      // apri il lettore con la ricerca già attiva ed evidenziata.
      setReaderQuery(withQuery);
      setReaderSearchOpen(true);
    } else {
      setReaderSearchOpen(false);
      setReaderQuery('');
    }
  };

  const closeTextModal = () => {
    setSelectedText(null);
    setEditingText(false);
    setTextDraft(null);
    setPdfState('idle');
    setPdfError('');
  };

  const startEditText = () => {
    setTextDraft({ ...selectedText });
    setEditingText(true);
  };

  const newText = () => {
    const draft = {
      id: 'txt-' + Date.now(),
      author: view,
      title: '',
      source: '',
      tags: '',
      body: '',
      translation: '',
      notes: '',
      linkedWords: '',
    };
    setSelectedText(draft);
    setTextDraft(draft);
    setEditingText(true);
  };

  const updateTextField = (field, value) => {
    setTextDraft((d) => ({ ...d, [field]: value }));
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = ''; // permette di ricaricare lo stesso file
    if (!file) return;
    setPdfState('loading');
    setPdfError('');
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = () => rej(new Error('lettura del file fallita'));
        r.readAsDataURL(file);
      });
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
      const block = isPdf
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
        : { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: base64 } };
      // Fuori dall'ambiente Claude serve una chiave API personale, salvata solo sul dispositivo.
      let apiKey = '';
      try { apiKey = localStorage.getItem('keter-api-key') || ''; } catch (e) {}
      if (!apiKey) {
        apiKey = (window.prompt(
          "Per estrarre il testo da PDF/immagini serve una chiave API Anthropic (inizia con sk-ant-...).\nSi crea su console.anthropic.com e verrà salvata solo su questo dispositivo."
        ) || '').trim();
        if (apiKey) { try { localStorage.setItem('keter-api-key', apiKey); } catch (e) {} }
      }
      if (!apiKey) throw new Error('chiave API mancante: estrazione annullata');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: [
                block,
                {
                  type: 'text',
                  text: 'Estrai fedelmente il testo ebraico da questo documento. Rispondi SOLO con il testo estratto, senza alcun commento, preambolo o traduzione. Mantieni la divisione in paragrafi separandoli con una riga vuota. Conserva il niqqud se presente. Ignora numeri di pagina, intestazioni correnti e note editoriali.',
                },
              ],
            },
          ],
        }),
      });
      const data = await response.json();
      if (data.error) {
        if (data.error.type === 'authentication_error') {
          try { localStorage.removeItem('keter-api-key'); } catch (e) {}
          throw new Error('chiave API non valida: riprova, ti verrà richiesta di nuovo');
        }
        throw new Error(data.error.message || 'errore API');
      }
      const extracted = (data.content || [])
        .map((i) => (i.type === 'text' ? i.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim();
      if (!extracted) throw new Error('nessun testo estratto dal documento');
      setTextDraft((d) => ({
        ...d,
        body: d.body && d.body.trim() ? d.body.trimEnd() + '\n\n' + extracted : extracted,
      }));
      if (data.stop_reason === 'max_tokens') {
        setPdfState('notice');
        setPdfError('Documento lungo: ho estratto solo la prima parte. Per testi lunghi carica il PDF in chat a Claude, che li fonderà nel file.');
      } else {
        setPdfState('idle');
      }
    } catch (err) {
      setPdfState('error');
      setPdfError('Estrazione fallita: ' + (err.message || 'errore sconosciuto'));
    }
  };

  // Set normalizzato dei vocaboli in evidenza di un testo
  const linkedSetOf = useCallback(
    (t) =>
      new Set(
        (t && t.linkedWords ? t.linkedWords : '')
          .split(',')
          .map((w) => cleanHebrewWord(w))
          .filter((w) => w.length > 1)
      ),
    [cleanHebrewWord]
  );

  // Una parola del testo corrisponde a un vocabolo in evidenza?
  const wordInSet = useCallback((w, set) => {
    if (set.has(w)) return true;
    const pc = 'והבלכמש';
    if (w.length > 2 && pc.includes(w[0])) {
      if (set.has(w.slice(1))) return true;
      if (w.length > 3 && pc.includes(w[1]) && set.has(w.slice(2))) return true;
    }
    return false;
  }, []);

  // Salva un oggetto testo aggiornato (locale-prima + storage best-effort)
  const persistTextObject = useCallback(
    async (saved) => {
      let updatedRef = null;
      setTexts((base) => {
        const isNew = !base.find((t) => t.id === saved.id);
        const updated = isNew ? [...base, saved] : base.map((t) => (t.id === saved.id ? saved : t));
        updatedRef = updated;
        return updated;
      });
      setSessionTexts((prev) => ({ ...prev, [saved.id]: saved }));
      try {
        if (updatedRef) await window.storage.set('keter-texts', JSON.stringify(updatedRef), false);
      } catch (err) {
        // resta comunque in sessionTexts
      }
    },
    []
  );

  const toggleLinkedWord = (word) => {
    if (!selectedText) return;
    const w = cleanHebrewWord(word);
    if (!w || w.length < 2) return;
    const current = (selectedText.linkedWords || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const currentClean = current.map((x) => cleanHebrewWord(x));
    let next;
    if (currentClean.includes(w)) {
      next = current.filter((x, i) => currentClean[i] !== w);
    } else {
      next = [...current, w];
    }
    const saved = { ...selectedText, linkedWords: next.join(', ') };
    setSelectedText(saved);
    if (editingText) setTextDraft((d) => ({ ...d, linkedWords: saved.linkedWords }));
    persistTextObject(saved);
  };

  const saveText = async () => {
    // 1. Stato locale, subito.
    const saved = { ...textDraft };
    const isNew = !texts.find((t) => t.id === saved.id);
    const updated = isNew ? [...texts, saved] : texts.map((t) => (t.id === saved.id ? saved : t));
    setTexts(updated);
    setSelectedText(saved);
    setSessionTexts((prev) => ({ ...prev, [saved.id]: saved }));
    unrecordDelete('testi', saved.id);
    setEditingText(false);
    setTextSaveState('saving');
    // 2. window.storage best-effort.
    let persisted = false;
    try {
      const res = await window.storage.set('keter-texts', JSON.stringify(updated), false);
      persisted = !!res;
    } catch (err) {
      persisted = false;
    }
    setTextSaveState(persisted ? 'saved' : 'saved-local');
    setTimeout(() => setTextSaveState('idle'), 2000);
  };

  // Rende un corpo ebraico come parole tappabili, paragrafo per paragrafo (RTL)
  const renderInteractiveHebrew = (body, linkedSet, query) => {
    if (!body) return null;
    const set = linkedSet || new Set();
    const qNorm = query ? normalizeHebrew(query.trim()) : '';
    return body.split('\n').map((line, li) => {
      if (!line.trim()) return <div key={li} style={{ height: 10 }} />;
      const parts = line.split(/(\s+)/);
      return (
        <div
          key={li}
          dir="rtl"
          style={{
            fontFamily: "'Frank Ruhl Libre', serif",
            fontSize: 20,
            lineHeight: 2,
            color: '#f0e4c8',
            textAlign: 'right',
          }}
        >
          {parts.map((p, pi) => {
            if (/^\s+$/.test(p) || !/[\u05D0-\u05EA]/.test(p)) {
              return <span key={pi}>{p}</span>;
            }
            const highlighted = wordInSet(cleanHebrewWord(p), set);
            const searchHit = qNorm && normalizeHebrew(p).includes(qNorm);
            return (
              <span
                key={pi}
                onClick={() => lookupWord(p)}
                style={{
                  ...(highlighted
                    ? {
                        cursor: 'pointer',
                        color: '#ffd24d',
                        borderBottom: '1px solid #e8b62a',
                        paddingBottom: 1,
                      }
                    : {
                        cursor: 'pointer',
                        borderBottom: '1px dotted #67a37788',
                        paddingBottom: 1,
                      }),
                  ...(searchHit
                    ? {
                        background: '#ffd24d',
                        color: '#1c1408',
                        fontWeight: 700,
                        borderRadius: 4,
                        padding: '0 4px',
                        borderBottom: '2px solid #e8b62a',
                        boxShadow: '0 0 6px #ffd24d88',
                      }
                    : {}),
                }}
              >
                {p}
              </span>
            );
          })}
        </div>
      );
    });
  };

  const updateDraftField = (field, value) => {
    setDraft((d) => ({ ...d, [field]: value }));
  };

  const filteredArticles = useMemo(() => {
    if (!articleQuery.trim()) return articles;
    const q = articleQuery.trim().toLowerCase();
    return articles.filter(
      (a) =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.tags || '').toLowerCase().includes(q) ||
        (a.body || '').toLowerCase().includes(q)
    );
  }, [articles, articleQuery]);

  const relatedEntries = useCallback(
    (article) => {
      if (!article || !article.relatedWords) return [];
      const words = article.relatedWords.split(',').map((w) => w.trim()).filter(Boolean);
      return words
        .map((w) => entries.find((e) => (e.Parola || '').trim() === w))
        .filter(Boolean);
    },
    [entries]
  );

  const jumpToEntry = (entry) => {
    setSelectedArticle(null);
    setView('lexicon');
    openEntry(entry);
  };

  const articlesForEntry = useCallback(
    (entry) => {
      if (!entry) return [];
      const word = (entry.Parola || '').trim();
      if (!word) return [];
      return articles.filter((a) =>
        (a.relatedWords || '').split(',').map((w) => w.trim()).includes(word)
      );
    },
    [articles]
  );

  const jumpToArticle = (article) => {
    setSelected(null);
    setView('articles');
    openArticle(article);
  };

  const openArticle = (a) => {
    setSelectedArticle(a);
    setEditingArticle(false);
    setArticleDraft(a);
  };

  const closeArticleModal = () => {
    setSelectedArticle(null);
    setEditingArticle(false);
    setArticleDraft(null);
  };

  const startEditArticle = () => {
    setArticleDraft({ ...selectedArticle });
    setEditingArticle(true);
  };

  const newArticle = () => {
    const draft = {
      id: 'custom-' + Date.now(),
      title: '',
      source: '',
      tags: '',
      relatedWords: '',
      body: '',
    };
    setSelectedArticle(draft);
    setArticleDraft(draft);
    setEditingArticle(true);
  };

  const updateArticleField = (field, value) => {
    setArticleDraft((d) => ({ ...d, [field]: value }));
  };

  const saveArticle = async () => {
    setArticleSaveState('saving');
    try {
      const saved = { ...articleDraft };
      const isNew = !articles.find((a) => a.id === saved.id);
      const updated = isNew ? [...articles, saved] : articles.map((a) => (a.id === saved.id ? saved : a));
      // 1. Stato locale, subito.
      setArticles(updated);
      setSelectedArticle(saved);
      setSessionArticles((prev) => ({ ...prev, [saved.id]: saved }));
      unrecordDelete('articoli', saved.id);
      setEditingArticle(false);
      // 2. window.storage best-effort.
      let persisted = false;
      try {
        const res = await window.storage.set('keter-articles', JSON.stringify(updated), false);
        persisted = !!res;
      } catch (err) {
        persisted = false;
      }
      setArticleSaveState(persisted ? 'saved' : 'saved-local');
      setTimeout(() => setArticleSaveState('idle'), 2000);
    } catch (err) {
      setArticleSaveState('error');
    }
  };

  const openImport = () => {
    setImportText('');
    setImportError('');
    setImporting(true);
  };

  const closeImport = () => {
    setImporting(false);
    setImportText('');
    setImportError('');
  };

  const submitImport = async () => {
    setImportError('');
    const raw = importText.trim();
    if (!raw) return;
    // Formato flessibile: array JSON, singolo oggetto, { articoli: [...] },
    // oppure testo semplice (prima riga = titolo, resto = corpo).
    let items = null;
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (err) { parsed = null; }
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed)) items = parsed;
      else if (Array.isArray(parsed.articoli)) items = parsed.articoli;
      else if (Array.isArray(parsed.articles)) items = parsed.articles;
      else if (parsed.lessico || parsed.testi) {
        setImportError('Questo è il JSON delle modifiche di sessione: incollalo nel pannello con l\u2019icona \u2191 in alto, non qui.');
        return;
      } else if (parsed.title || parsed.body) items = [parsed];
      else {
        setImportError('JSON riconosciuto ma senza articoli: serve un array [...], un oggetto { articoli: [...] } o un singolo articolo con title/body.');
        return;
      }
    } else {
      const lines = raw.split('\n');
      const title = (lines[0] || '').trim().slice(0, 120) || 'Senza titolo';
      const body = lines.length > 1 ? lines.slice(1).join('\n').trim() : raw;
      items = [{ title, body }];
    }
    items = items.filter((a) => a && typeof a === 'object');
    if (!items.length) {
      setImportError('Nessun articolo trovato nel testo incollato.');
      return;
    }
    const now = Date.now();
    const newArticles = items.map((a, i) => ({
      id: 'custom-' + now + '-' + i,
      title: a.title || '',
      source: a.source || '',
      tags: a.tags || '',
      relatedWords: a.relatedWords || '',
      body: a.body || '',
    }));
    const updated = [...articles, ...newArticles];
    // 1. Stato locale, subito.
    setArticles(updated);
    setSessionArticles((prev) => {
      const next = { ...prev };
      newArticles.forEach((a) => { next[a.id] = a; });
      return next;
    });
    setImporting(false);
    setImportText('');
    // 2. window.storage best-effort.
    try {
      await window.storage.set('keter-articles', JSON.stringify(updated), false);
    } catch (err) {
      // resta comunque in sessionArticles, pubblicabile
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at top, #336646 0%, #3a6647 55%, #213a28 100%)',
        color: '#ece4d3',
        fontFamily: "'Cormorant Garamond', Georgia, serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: #e8b62a55; }
        .keter-scroll::-webkit-scrollbar { width: 8px; }
        .keter-scroll::-webkit-scrollbar-thumb { background: #6ba57a; border-radius: 4px; }
        .keter-scroll::-webkit-scrollbar-track { background: transparent; }
        button:focus-visible, input:focus-visible, textarea:focus-visible {
          outline: 2px solid #e8b62a;
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'linear-gradient(180deg, #3a6647 0%, #3a6647ee 85%, transparent)',
          backdropFilter: 'blur(6px)',
          borderBottom: '1px solid #487d58',
          padding: '18px 20px 14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Crown size={22} color="#e8b62a" strokeWidth={1.5} />
          <h1
            style={{
              margin: 0,
              fontFamily: "'Frank Ruhl Libre', serif",
              fontWeight: 700,
              fontSize: 24,
              letterSpacing: 0.5,
              color: '#f0e4c8',
            }}
          >
            Keter <span style={{ color: '#e8b62a', fontSize: 18 }}>כֶּתֶר</span>
          </h1>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: '#8a7f68', fontFamily: "'Inter', sans-serif" }}>
            {view === 'lexicon' ? `${filtered.length} / ${entries.length}` : view === 'articles' ? `${filteredArticles.length} / ${articles.length}` : `${filteredTexts.length} testi`}
          </span>
          <button
            onClick={() => setEditsPanel('export')}
            aria-label="Pubblica o esporta modifiche"
            style={{
              position: 'relative',
              background: 'none',
              border: '1px solid #487d58',
              borderRadius: 8,
              color: pendingCount ? '#ffd24d' : '#8a7f68',
              padding: '5px 7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Download size={14} />
            {pendingCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  background: '#e8b62a',
                  color: '#1a2b20',
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 700,
                  minWidth: 15,
                  height: 15,
                  lineHeight: '15px',
                  textAlign: 'center',
                  padding: '0 3px',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setEditsImportError(''); setEditsPanel('import'); }}
            aria-label="Importa modifiche"
            style={{
              background: 'none',
              border: '1px solid #487d58',
              borderRadius: 8,
              color: '#8a7f68',
              padding: '5px 7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Upload size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
          {[
            { id: 'lexicon', label: 'Lessico', Icon: Crown },
            { id: 'articles', label: 'Articoli', Icon: Library },
            { id: 'agnon', label: 'Agnon', Icon: Feather },
            { id: 'shabtai', label: 'Shabtai', Icon: PenLine },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                padding: '8px 4px',
                borderRadius: 8,
                border: `1px solid ${view === id ? '#e8b62a' : '#67a377'}`,
                background: view === id ? '#e8b62a22' : 'transparent',
                color: view === id ? '#ffd24d' : '#a89c81',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {view === 'lexicon' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#2d5c3c',
            border: '1px solid #67a377',
            borderRadius: 10,
            padding: '9px 12px',
          }}
        >
          <Search size={16} color="#8a7f68" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca una parola o una traduzione…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#ece4d3',
              fontSize: 15,
              fontFamily: "'Inter', sans-serif",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', color: '#8a7f68', cursor: 'pointer', padding: 2 }}
              aria-label="Cancella ricerca"
            >
              <X size={15} />
            </button>
          )}
        </div>
        )}

        {view === 'lexicon' && tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
            <button
              onClick={() => setActiveTag('all')}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                padding: '5px 11px',
                borderRadius: 999,
                border: `1px solid ${activeTag === 'all' ? '#e8b62a' : '#67a377'}`,
                background: activeTag === 'all' ? '#e8b62a22' : 'transparent',
                color: activeTag === 'all' ? '#ffd24d' : '#8a7f68',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              Tutte
            </button>
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTag(t)}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  padding: '5px 11px',
                  borderRadius: 999,
                  border: `1px solid ${activeTag === t ? tagColor(t) : '#67a377'}`,
                  background: activeTag === t ? tagColor(t) + '22' : 'transparent',
                  color: activeTag === t ? tagColor(t) : '#8a7f68',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {view === 'articles' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#2d5c3c',
              border: '1px solid #67a377',
              borderRadius: 10,
              padding: '9px 12px',
            }}
          >
            <Search size={16} color="#8a7f68" />
            <input
              value={articleQuery}
              onChange={(e) => setArticleQuery(e.target.value)}
              placeholder="Cerca un articolo…"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#ece4d3',
                fontSize: 15,
                fontFamily: "'Inter', sans-serif",
              }}
            />
            {articleQuery && (
              <button
                onClick={() => setArticleQuery('')}
                style={{ background: 'none', border: 'none', color: '#8a7f68', cursor: 'pointer', padding: 2 }}
                aria-label="Cancella ricerca"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}

        {(view === 'agnon' || view === 'shabtai') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#2d5c3c',
              border: '1px solid #67a377',
              borderRadius: 10,
              padding: '9px 12px',
            }}
          >
            <Search size={16} color="#8a7f68" />
            <input
              value={textQuery}
              onChange={(e) => setTextQuery(e.target.value)}
              placeholder={view === 'agnon' ? 'Cerca nei testi di Agnon…' : 'Cerca nei testi di Shabtai…'}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#ece4d3',
                fontSize: 15,
                fontFamily: "'Inter', sans-serif",
              }}
            />
            {textQuery && (
              <button
                onClick={() => setTextQuery('')}
                style={{ background: 'none', border: 'none', color: '#8a7f68', cursor: 'pointer', padding: 2 }}
                aria-label="Cancella ricerca"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}
      </header>

      {/* List */}
      <main style={{ padding: '14px 16px 60px', maxWidth: 720, margin: '0 auto' }}>
        {view === 'lexicon' ? (
        !loaded ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#6b6250', fontFamily: "'Inter', sans-serif" }}>
            Caricamento del lessico…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={newEntry}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: 'transparent',
                border: '1px dashed #67a377',
                borderRadius: 10,
                padding: '11px 14px',
                color: '#96c4a0',
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Nuova voce
            </button>

            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#6b6250', fontFamily: "'Inter', sans-serif" }}>
                Nessuna voce trovata. Prova un'altra ricerca.
              </div>
            ) : (
              <>
                {filtered.slice(0, 400).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => openEntry(e)}
                    style={{
                      textAlign: 'left',
                      background: '#28442a',
                      border: '1px solid #457a54',
                      borderRadius: 10,
                      padding: '13px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 32, color: '#f0e4c8' }}>
                        <FieldText text={e.Parola} />
                      </div>
                      {e.Traduzione && (
                        <div style={{ fontSize: 20, color: '#e8b62a', marginTop: 3 }}>
                          <FieldText text={e.Traduzione} />
                        </div>
                      )}
                    </div>
                    {e.Tag && (
                      <span
                        style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 10,
                          padding: '3px 8px',
                          borderRadius: 999,
                          border: `1px solid ${tagColor(e.Tag.trim())}66`,
                          color: tagColor(e.Tag.trim()),
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {e.Tag.trim()}
                      </span>
                    )}
                    <ChevronRight size={16} color="#96c4a0" style={{ flexShrink: 0 }} />
                  </button>
                ))}
                {filtered.length > 400 && (
                  <div style={{ textAlign: 'center', padding: '14px 0', color: '#6b6250', fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                    Mostrando le prime 400 di {filtered.length} voci — affina la ricerca per vedere il resto.
                  </div>
                )}
              </>
            )}
          </div>
        )
        ) : view === 'articles' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={newArticle}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: 'transparent',
                  border: '1px dashed #67a377',
                  borderRadius: 10,
                  padding: '11px 14px',
                  color: '#96c4a0',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Nuovo articolo
              </button>
              <button
                onClick={openImport}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: 'transparent',
                  border: '1px dashed #67a377',
                  borderRadius: 10,
                  padding: '11px 14px',
                  color: '#96c4a0',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <Library size={14} /> Importa
              </button>
            </div>

            {filteredArticles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#6b6250', fontFamily: "'Inter', sans-serif" }}>
                Nessun articolo trovato.
              </div>
            ) : (
              filteredArticles.map((a) => (
                <button
                  key={a.id}
                  onClick={() => openArticle(a)}
                  style={{
                    textAlign: 'left',
                    background: '#28442a',
                    border: '1px solid #457a54',
                    borderRadius: 10,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <BookOpen size={16} color="#e8b62a" style={{ marginTop: 3, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontFamily: "'Frank Ruhl Libre', serif", color: '#f0e4c8' }}>
                        {a.title || 'Senza titolo'}
                      </div>
                      {a.source && (
                        <div style={{ fontSize: 12, color: '#8a7f68', marginTop: 2, fontFamily: "'Inter', sans-serif" }}>
                          {a.source}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={16} color="#96c4a0" style={{ flexShrink: 0, marginTop: 3 }} />
                  </div>
                  {a.body && (
                    <div style={{ fontSize: 13, color: '#cfc4a8', lineHeight: 1.5, marginLeft: 26 }}>
                      {a.body.slice(0, 130).trim()}{a.body.length > 130 ? '…' : ''}
                    </div>
                  )}
                  {a.tags && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginLeft: 26 }}>
                      {a.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                        <span
                          key={t}
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 10,
                            padding: '2px 8px',
                            borderRadius: 999,
                            border: '1px solid #67a37766',
                            color: '#96c4a0',
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={newText}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: 'transparent',
                border: '1px dashed #67a377',
                borderRadius: 10,
                padding: '11px 14px',
                color: '#96c4a0',
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Nuovo testo
            </button>

            {filteredTexts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#6b6250', fontFamily: "'Inter', sans-serif" }}>
                {texts.some((t) => t.author === view)
                  ? 'Nessun testo trovato.'
                  : `Nessun testo di ${view === 'agnon' ? 'Agnon' : 'Shabtai'} ancora. Aggiungine uno.`}
              </div>
            ) : (
              filteredTexts.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openText(t, textMatches.has(t.id) ? textQuery.trim() : '')}
                  style={{
                    textAlign: 'left',
                    background: '#28442a',
                    border: '1px solid #457a54',
                    borderRadius: 10,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {view === 'agnon' ? (
                      <Feather size={16} color="#e8b62a" style={{ marginTop: 3, flexShrink: 0 }} />
                    ) : (
                      <PenLine size={16} color="#e8b62a" style={{ marginTop: 3, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontFamily: "'Frank Ruhl Libre', serif", color: '#f0e4c8' }}>
                        {t.title || 'Senza titolo'}
                      </div>
                      {t.source && (
                        <div style={{ fontSize: 12, color: '#8a7f68', marginTop: 2, fontFamily: "'Inter', sans-serif" }}>
                          {t.source}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={16} color="#96c4a0" style={{ flexShrink: 0, marginTop: 3 }} />
                  </div>
                  {textMatches.has(t.id) ? (
                    <>
                      <div
                        dir="rtl"
                        style={{
                          fontSize: 16,
                          color: '#e6dcc2',
                          lineHeight: 1.9,
                          fontFamily: "'Frank Ruhl Libre', serif",
                          textAlign: 'right',
                          width: '100%',
                        }}
                      >
                        {textMatches.get(t.id).before}
                        <span
                          style={{
                            background: '#ffd24d',
                            color: '#1c1408',
                            fontWeight: 700,
                            borderRadius: 4,
                            padding: '0 4px',
                            borderBottom: '2px solid #e8b62a',
                          }}
                        >
                          {textMatches.get(t.id).hit}
                        </span>
                        {textMatches.get(t.id).after}
                      </div>
                      <div
                        style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 11,
                          color: '#96c4a0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Search size={11} />
                        {textMatches.get(t.id).count === 1
                          ? '1 occorrenza nel testo'
                          : `${textMatches.get(t.id).count} occorrenze nel testo`}
                        {' — tocca per aprirle nel lettore'}
                      </div>
                    </>
                  ) : t.body ? (
                    <div
                      dir="rtl"
                      style={{
                        fontSize: 16,
                        color: '#e6dcc2',
                        lineHeight: 1.7,
                        fontFamily: "'Frank Ruhl Libre', serif",
                        textAlign: 'right',
                        width: '100%',
                      }}
                    >
                      {t.body.slice(0, 110).trim()}{t.body.length > 110 ? '…' : ''}
                    </div>
                  ) : null}
                  {t.tags && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {t.tags.split(',').map((x) => x.trim()).filter(Boolean).map((x) => (
                        <span
                          key={x}
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 10,
                            padding: '2px 8px',
                            borderRadius: 999,
                            border: '1px solid #67a37766',
                            color: '#96c4a0',
                          }}
                        >
                          {x}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </main>

      {/* Modal */}
      {selected && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000000cc',
            zIndex: 35,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="keter-scroll"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '86vh',
              overflowY: 'auto',
              background: '#2d5638',
              border: '1px solid #67a377',
              borderTop: 'none',
              borderRadius: '0 0 18px 18px',
              padding: '20px 20px 32px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
              {!editing ? (
                <>
                <button
                  onClick={deleteEntry}
                  style={{
                    background: 'none',
                    border: '1px solid #a04b3e',
                    borderRadius: 8,
                    color: '#e08b7d',
                    padding: '6px 10px',
                    fontSize: 12,
                    fontFamily: "'Inter', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                  }}
                >
                  <X size={13} /> Elimina
                </button>
                <button
                  onClick={startEdit}
                  style={{
                    background: 'none',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#e8b62a',
                    padding: '6px 10px',
                    fontSize: 12,
                    fontFamily: "'Inter', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                  }}
                >
                  <Edit3 size={13} /> Modifica
                </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setDraft(selected); setEditing(false); }}
                    style={{
                      background: 'none',
                      border: '1px solid #67a377',
                      borderRadius: 8,
                      color: '#8a7f68',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontFamily: "'Inter', sans-serif",
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={13} /> Annulla
                  </button>
                  <button
                    onClick={saveEdit}
                    style={{
                      background: '#e8b62a22',
                      border: '1px solid #e8b62a',
                      borderRadius: 8,
                      color: '#ffd24d',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontFamily: "'Inter', sans-serif",
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <Save size={13} /> {saveState === 'saving' ? 'Salvo…' : saveState === 'saved' ? 'Salvato ✓' : saveState === 'saved-local' ? 'Salvato (sessione) ✓' : 'Salva'}
                  </button>
                </>
              )}
              <button
                onClick={closeModal}
                style={{ background: 'none', border: 'none', color: '#8a7f68', cursor: 'pointer', padding: 6 }}
                aria-label="Chiudi"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 32, marginBottom: 4 }}>
              {editing ? (
                <input
                  value={draft.Parola || ''}
                  onChange={(ev) => updateDraftField('Parola', ev.target.value)}
                  dir={isHebrewText(draft.Parola) ? 'rtl' : 'ltr'}
                  placeholder="מִלָּה — la parola"
                  style={{
                    width: '100%',
                    background: '#3a6647',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#f0e4c8',
                    fontSize: 26,
                    padding: '8px 10px',
                    fontFamily: "'Frank Ruhl Libre', serif",
                  }}
                />
              ) : (
                <FieldText text={selected.Parola} />
              )}
            </div>

            <div style={{ fontSize: 20, color: '#e8b62a', marginBottom: 18 }}>
              {editing ? (
                <input
                  value={draft.Traduzione || ''}
                  onChange={(ev) => updateDraftField('Traduzione', ev.target.value)}
                  dir={isHebrewText(draft.Traduzione) ? 'rtl' : 'ltr'}
                  placeholder="Traduzione italiana"
                  style={{
                    width: '100%',
                    background: '#3a6647',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#ffd24d',
                    fontSize: 17,
                    padding: '7px 10px',
                    marginTop: 6,
                    fontFamily: "'Cormorant Garamond', serif",
                  }}
                />
              ) : (
                <FieldText text={selected.Traduzione} />
              )}
            </div>

            {DETAIL_FIELDS.map((field) => {
              const value = editing ? draft[field] : selected[field];
              if (!editing && !value) return null;
              return (
                <div key={field} style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 11,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      color: '#6b6250',
                      marginBottom: 6,
                    }}
                  >
                    {FIELD_LABELS[field]}
                  </div>
                  {editing ? (
                    <textarea
                      value={draft[field] || ''}
                      onChange={(ev) => updateDraftField(field, ev.target.value)}
                      dir={isHebrewText(draft[field]) ? 'rtl' : 'ltr'}
                      rows={3}
                      style={{
                        width: '100%',
                        background: '#3a6647',
                        border: '1px solid #67a377',
                        borderRadius: 8,
                        color: '#ece4d3',
                        fontSize: 14,
                        padding: '8px 10px',
                        fontFamily: "'Cormorant Garamond', serif",
                        resize: 'vertical',
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: 17, color: '#cfc4a8' }}>
                      <FieldText text={value} />
                    </div>
                  )}
                </div>
              );
            })}

            {!editing && articlesForEntry(selected).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 11,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: '#6b6250',
                    marginBottom: 6,
                  }}
                >
                  Articoli correlati
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {articlesForEntry(selected).map((a) => (
                    <button
                      key={a.id}
                      onClick={() => jumpToArticle(a)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        textAlign: 'left',
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 13,
                        padding: '7px 11px',
                        borderRadius: 8,
                        border: '1px solid #e8b62a66',
                        background: '#e8b62a11',
                        color: '#ffd24d',
                        cursor: 'pointer',
                      }}
                    >
                      <BookOpen size={13} style={{ flexShrink: 0 }} /> {a.title || 'Senza titolo'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editing && (
              <div style={{ marginBottom: 4 }}>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 11,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: '#6b6250',
                    marginBottom: 6,
                  }}
                >
                  Tag
                </div>
                <input
                  value={draft.Tag || ''}
                  onChange={(ev) => updateDraftField('Tag', ev.target.value)}
                  style={{
                    width: '100%',
                    background: '#3a6647',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#ece4d3',
                    fontSize: 13,
                    padding: '7px 10px',
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Article Modal */}
      {selectedArticle && (
        <div
          onClick={closeArticleModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000000cc',
            zIndex: 30,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="keter-scroll"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '86vh',
              overflowY: 'auto',
              background: '#0e1a13',
              border: '1px solid #67a377',
              borderBottom: 'none',
              borderRadius: '18px 18px 0 0',
              padding: '20px 20px 32px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
              {!editingArticle ? (
                <>
                <button
                  onClick={deleteArticle}
                  style={{
                    background: 'none',
                    border: '1px solid #a04b3e',
                    borderRadius: 8,
                    color: '#e08b7d',
                    padding: '6px 10px',
                    fontSize: 12,
                    fontFamily: "'Inter', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                  }}
                >
                  <X size={13} /> Elimina
                </button>
                <button
                  onClick={startEditArticle}
                  style={{
                    background: 'none',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#e8b62a',
                    padding: '6px 10px',
                    fontSize: 12,
                    fontFamily: "'Inter', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                  }}
                >
                  <Edit3 size={13} /> Modifica
                </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setArticleDraft(selectedArticle); setEditingArticle(false); }}
                    style={{
                      background: 'none',
                      border: '1px solid #67a377',
                      borderRadius: 8,
                      color: '#8a7f68',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontFamily: "'Inter', sans-serif",
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={13} /> Annulla
                  </button>
                  <button
                    onClick={saveArticle}
                    style={{
                      background: '#e8b62a22',
                      border: '1px solid #e8b62a',
                      borderRadius: 8,
                      color: '#ffd24d',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontFamily: "'Inter', sans-serif",
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <Save size={13} /> {articleSaveState === 'saving' ? 'Salvo…' : articleSaveState === 'saved' ? 'Salvato ✓' : articleSaveState === 'saved-local' ? 'Salvato (sessione) ✓' : 'Salva'}
                  </button>
                </>
              )}
              <button
                onClick={closeArticleModal}
                style={{ background: 'none', border: 'none', color: '#8a7f68', cursor: 'pointer', padding: 6 }}
                aria-label="Chiudi"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 22, marginBottom: 4, fontFamily: "'Frank Ruhl Libre', serif", color: '#f0e4c8' }}>
              {editingArticle ? (
                <input
                  value={articleDraft.title || ''}
                  onChange={(ev) => updateArticleField('title', ev.target.value)}
                  placeholder="Titolo"
                  style={{
                    width: '100%',
                    background: '#142218',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#f0e4c8',
                    fontSize: 18,
                    padding: '8px 10px',
                    fontFamily: "'Frank Ruhl Libre', serif",
                  }}
                />
              ) : (
                selectedArticle.title || 'Senza titolo'
              )}
            </div>

            <div style={{ fontSize: 13, color: '#e8b62a', marginBottom: 18, fontFamily: "'Inter', sans-serif" }}>
              {editingArticle ? (
                <input
                  value={articleDraft.source || ''}
                  onChange={(ev) => updateArticleField('source', ev.target.value)}
                  placeholder="Fonte / riferimento"
                  style={{
                    width: '100%',
                    background: '#142218',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#ffd24d',
                    fontSize: 13,
                    padding: '7px 10px',
                    marginTop: 6,
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
              ) : (
                selectedArticle.source
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: '#6b6250',
                  marginBottom: 6,
                }}
              >
                Testo
              </div>
              {editingArticle ? (
                <textarea
                  value={articleDraft.body || ''}
                  onChange={(ev) => updateArticleField('body', ev.target.value)}
                  rows={10}
                  style={{
                    width: '100%',
                    background: '#142218',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#ece4d3',
                    fontSize: 14,
                    padding: '10px',
                    fontFamily: "'Cormorant Garamond', serif",
                    resize: 'vertical',
                    lineHeight: 1.6,
                  }}
                />
              ) : (
                <div style={{ fontSize: 15, color: '#cfc4a8', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontFamily: "'Cormorant Garamond', serif" }}>
                  {selectedArticle.body}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: '#6b6250',
                  marginBottom: 6,
                }}
              >
                Tag
              </div>
              {editingArticle ? (
                <input
                  value={articleDraft.tags || ''}
                  onChange={(ev) => updateArticleField('tags', ev.target.value)}
                  placeholder="es. Morfologia, Stile"
                  style={{
                    width: '100%',
                    background: '#142218',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#ece4d3',
                    fontSize: 13,
                    padding: '7px 10px',
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
              ) : (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {(selectedArticle.tags || '').split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                    <span
                      key={t}
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 11,
                        padding: '3px 9px',
                        borderRadius: 999,
                        border: '1px solid #67a37766',
                        color: '#96c4a0',
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: '#6b6250',
                  marginBottom: 6,
                }}
              >
                Voci correlate
              </div>
              {editingArticle ? (
                <input
                  value={articleDraft.relatedWords || ''}
                  onChange={(ev) => updateArticleField('relatedWords', ev.target.value)}
                  placeholder="Parole in ebraico separate da virgola, es. גזר, בנה"
                  dir="auto"
                  style={{
                    width: '100%',
                    background: '#142218',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#ece4d3',
                    fontSize: 14,
                    padding: '7px 10px',
                    fontFamily: "'Frank Ruhl Libre', serif",
                  }}
                />
              ) : relatedEntries(selectedArticle).length > 0 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {relatedEntries(selectedArticle).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => jumpToEntry(e)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontFamily: "'Frank Ruhl Libre', serif",
                        fontSize: 13,
                        padding: '5px 11px',
                        borderRadius: 999,
                        border: '1px solid #e8b62a66',
                        background: '#e8b62a11',
                        color: '#ffd24d',
                        cursor: 'pointer',
                      }}
                    >
                      <Link2 size={11} /> {e.Parola}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#6b6250', fontFamily: "'Inter', sans-serif" }}>
                  Nessuna voce collegata.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importing && (
        <div
          onClick={closeImport}
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000000cc',
            zIndex: 30,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="keter-scroll"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '86vh',
              overflowY: 'auto',
              background: '#0e1a13',
              border: '1px solid #67a377',
              borderBottom: 'none',
              borderRadius: '18px 18px 0 0',
              padding: '20px 20px 32px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontFamily: "'Frank Ruhl Libre', serif", color: '#f0e4c8' }}>
                Importa articoli
              </div>
              <button
                onClick={closeImport}
                style={{ background: 'none', border: 'none', color: '#8a7f68', cursor: 'pointer', padding: 6 }}
                aria-label="Chiudi"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 13, color: '#a89c81', marginBottom: 12, fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
              Incolla articoli in JSON — un array [...], un singolo oggetto o {'{ articoli: [...] }'} — oppure semplice testo: in quel caso la prima riga diventa il titolo e il resto il corpo. Campi riconosciuti: title, source, tags, relatedWords, body.
            </div>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'[\n  {\n    "title": "...",\n    "source": "...",\n    "tags": "Morfologia",\n    "relatedWords": "גזר, בנה",\n    "body": "..."\n  }\n]'}
              rows={12}
              style={{
                width: '100%',
                background: '#142218',
                border: '1px solid #67a377',
                borderRadius: 8,
                color: '#ece4d3',
                fontSize: 13,
                padding: '10px',
                fontFamily: "'Inter', monospace",
                resize: 'vertical',
                marginBottom: 10,
              }}
            />

            {importError && (
              <div style={{ fontSize: 13, color: '#c98f4b', marginBottom: 10, fontFamily: "'Inter', sans-serif" }}>
                {importError}
              </div>
            )}

            <button
              onClick={submitImport}
              disabled={!importText.trim()}
              style={{
                background: '#e8b62a22',
                border: '1px solid #e8b62a',
                borderRadius: 8,
                color: '#ffd24d',
                padding: '8px 14px',
                fontSize: 13,
                fontFamily: "'Inter', sans-serif",
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: importText.trim() ? 'pointer' : 'not-allowed',
                opacity: importText.trim() ? 1 : 0.5,
              }}
            >
              <Save size={13} /> Importa articoli
            </button>
          </div>
        </div>
      )}

      {/* Text Modal */}
      {selectedText && (
        <div
          onClick={closeTextModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000000cc',
            zIndex: 30,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="keter-scroll"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#0e1a13',
              border: '1px solid #67a377',
              borderBottom: 'none',
              borderRadius: '18px 18px 0 0',
              padding: '20px 20px 40px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingText ? (
                  <input
                    value={textDraft.title}
                    onChange={(e) => updateTextField('title', e.target.value)}
                    placeholder="Titolo"
                    style={{
                      width: '100%',
                      background: '#142218',
                      border: '1px solid #67a377',
                      borderRadius: 8,
                      color: '#f0e4c8',
                      fontSize: 17,
                      padding: '8px 10px',
                      fontFamily: "'Frank Ruhl Libre', serif",
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 20, fontFamily: "'Frank Ruhl Libre', serif", color: '#f0e4c8' }}>
                    {selectedText.title || 'Senza titolo'}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {!editingText && (
                  <button
                    onClick={() => {
                      if (readerSearchOpen) {
                        setReaderQuery('');
                        setReaderSearchOpen(false);
                      } else {
                        setReaderSearchOpen(true);
                      }
                    }}
                    title="Cerca nel testo"
                    style={{
                      background: readerSearchOpen ? '#e8b62a22' : 'none',
                      border: readerSearchOpen ? '1px solid #e8b62a' : '1px solid #67a377',
                      borderRadius: 8,
                      color: readerSearchOpen ? '#ffd24d' : '#96c4a0',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontFamily: "'Inter', sans-serif",
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <Search size={13} /> Cerca
                  </button>
                )}
                {!editingText ? (
                  <>
                  <button
                    onClick={deleteText}
                    style={{
                      background: 'none',
                      border: '1px solid #a04b3e',
                      borderRadius: 8,
                      color: '#e08b7d',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontFamily: "'Inter', sans-serif",
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <X size={13} /> Elimina
                  </button>
                  <button
                    onClick={startEditText}
                    style={{
                      background: 'none',
                      border: '1px solid #67a377',
                      borderRadius: 8,
                      color: '#96c4a0',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontFamily: "'Inter', sans-serif",
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <Edit3 size={13} /> Modifica
                  </button>
                  </>
                ) : (
                  <button
                    onClick={saveText}
                    style={{
                      background: '#e8b62a22',
                      border: '1px solid #e8b62a',
                      borderRadius: 8,
                      color: '#ffd24d',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontFamily: "'Inter', sans-serif",
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <Save size={13} /> {textSaveState === 'saving' ? 'Salvo…' : textSaveState === 'saved' ? 'Salvato ✓' : textSaveState === 'saved-local' ? 'Salvato (sessione) ✓' : 'Salva'}
                  </button>
                )}
                <button
                  onClick={closeTextModal}
                  style={{ background: 'none', border: 'none', color: '#8a7f68', cursor: 'pointer', padding: 6 }}
                  aria-label="Chiudi"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {editingText ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                <input
                  value={textDraft.source}
                  onChange={(e) => updateTextField('source', e.target.value)}
                  placeholder="Opera / fonte (es. תמול שלשום, cap. 3)"
                  style={{
                    width: '100%',
                    background: '#142218',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#ece4d3',
                    fontSize: 13,
                    padding: '8px 10px',
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
                <input
                  value={textDraft.tags}
                  onChange={(e) => updateTextField('tags', e.target.value)}
                  placeholder="Tag (separati da virgola)"
                  style={{
                    width: '100%',
                    background: '#142218',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#ece4d3',
                    fontSize: 13,
                    padding: '8px 10px',
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
                <input
                  value={textDraft.linkedWords || ''}
                  onChange={(e) => updateTextField('linkedWords', e.target.value)}
                  dir="rtl"
                  placeholder="…מילים, מילים — vocaboli in evidenza, separati da virgola"
                  style={{
                    width: '100%',
                    background: '#142218',
                    border: '1px solid #e8b62a66',
                    borderRadius: 8,
                    color: '#ffd24d',
                    fontSize: 15,
                    padding: '8px 10px',
                    fontFamily: "'Frank Ruhl Libre', serif",
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: -4 }}>
                  <div style={{ fontSize: 11, color: '#8a7f68', fontFamily: "'Inter', sans-serif" }}>
                    Testo ebraico
                  </div>
                  <button
                    onClick={() => pdfInputRef.current && pdfInputRef.current.click()}
                    disabled={pdfState === 'loading'}
                    style={{
                      background: 'none',
                      border: '1px dashed #67a377',
                      borderRadius: 8,
                      color: pdfState === 'loading' ? '#8a7f68' : '#96c4a0',
                      padding: '4px 9px',
                      fontSize: 11,
                      fontFamily: "'Inter', sans-serif",
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: pdfState === 'loading' ? 'wait' : 'pointer',
                    }}
                  >
                    <FileUp size={12} /> {pdfState === 'loading' ? 'Estraggo il testo…' : 'Carica PDF / foto'}
                  </button>
                </div>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handlePdfUpload}
                  style={{ display: 'none' }}
                />
                {(pdfState === 'error' || pdfState === 'notice') && (
                  <div
                    style={{
                      fontSize: 12,
                      color: pdfState === 'error' ? '#c98f4b' : '#e8b62a',
                      fontFamily: "'Inter', sans-serif",
                      lineHeight: 1.5,
                    }}
                  >
                    {pdfError}
                  </div>
                )}
                <textarea
                  value={textDraft.body}
                  onChange={(e) => updateTextField('body', e.target.value)}
                  dir="rtl"
                  rows={10}
                  placeholder="הטקסט העברי…"
                  style={{
                    width: '100%',
                    background: '#142218',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#f0e4c8',
                    fontSize: 18,
                    lineHeight: 1.8,
                    padding: '10px',
                    fontFamily: "'Frank Ruhl Libre', serif",
                    resize: 'vertical',
                  }}
                />
                <div style={{ fontSize: 11, color: '#8a7f68', fontFamily: "'Inter', sans-serif", marginBottom: -4 }}>
                  Traduzione
                </div>
                <textarea
                  value={textDraft.translation}
                  onChange={(e) => updateTextField('translation', e.target.value)}
                  rows={6}
                  placeholder="La tua traduzione italiana…"
                  style={{
                    width: '100%',
                    background: '#142218',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#ece4d3',
                    fontSize: 14,
                    lineHeight: 1.6,
                    padding: '10px',
                    fontFamily: "'Inter', sans-serif",
                    resize: 'vertical',
                  }}
                />
                <div style={{ fontSize: 11, color: '#8a7f68', fontFamily: "'Inter', sans-serif", marginBottom: -4 }}>
                  Note
                </div>
                <textarea
                  value={textDraft.notes}
                  onChange={(e) => updateTextField('notes', e.target.value)}
                  rows={4}
                  placeholder="Note stilistiche, lessicali, letterarie…"
                  style={{
                    width: '100%',
                    background: '#142218',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#ece4d3',
                    fontSize: 14,
                    lineHeight: 1.6,
                    padding: '10px',
                    fontFamily: "'Inter', sans-serif",
                    resize: 'vertical',
                  }}
                />
              </div>
            ) : (
              <>
                {selectedText.source && (
                  <div style={{ fontSize: 13, color: '#8a7f68', fontFamily: "'Inter', sans-serif", marginBottom: 14 }}>
                    {selectedText.source}
                  </div>
                )}
                {readerSearchOpen && (
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <Search size={15} style={{ position: 'absolute', top: 11, right: 12, color: '#67a377' }} />
                    <input
                      value={readerQuery}
                      onChange={(e) => setReaderQuery(e.target.value)}
                      placeholder="Cerca nel testo…"
                      autoFocus
                      dir="auto"
                      style={{
                        width: '100%',
                        background: '#142218',
                        border: '1px solid #67a377',
                        borderRadius: 10,
                        color: '#f0e4c8',
                        fontSize: 15,
                        padding: '9px 36px 9px 12px',
                        fontFamily: "'Frank Ruhl Libre', serif",
                        boxSizing: 'border-box',
                      }}
                    />
                    {readerQuery && (
                      <X
                        size={15}
                        onClick={() => setReaderQuery('')}
                        style={{ position: 'absolute', top: 11, left: 12, color: '#8a7f68', cursor: 'pointer' }}
                      />
                    )}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#67a377', fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>
                  Tocca una parola per cercarla nel Lessico
                </div>
                {(() => {
                  const allLines = (selectedText.body || '').split('\n');
                  const rq = readerSearchOpen ? readerQuery.trim() : '';
                  if (rq) {
                    const rqNorm = normalizeHebrew(rq);
                    const matched = allLines.filter((l) => l.trim() && normalizeHebrew(l).includes(rqNorm));
                    return (
                      <>
                        <div style={{ fontSize: 12, color: matched.length ? '#96c4a0' : '#8a7f68', fontFamily: "'Inter', sans-serif", marginBottom: 10 }}>
                          {matched.length
                            ? `${matched.length} paragraf${matched.length === 1 ? 'o' : 'i'} trovat${matched.length === 1 ? 'o' : 'i'}`
                            : 'Nessun paragrafo trovato'}
                        </div>
                        {matched.length > 0 && (
                          <div style={{ marginBottom: 18 }}>
                            {renderInteractiveHebrew(matched.join('\n\n'), linkedSetOf(selectedText), rq)}
                          </div>
                        )}
                      </>
                    );
                  }
                  const totalParas = allLines.filter((l) => l.trim()).length;
                  let count = 0;
                  let cut = allLines.length;
                  for (let i = 0; i < allLines.length; i++) {
                    if (allLines[i].trim()) count++;
                    if (count >= visibleParas) {
                      cut = i + 1;
                      break;
                    }
                  }
                  const shown = allLines.slice(0, cut).join('\n');
                  return (
                    <>
                      <div style={{ marginBottom: 18 }}>{renderInteractiveHebrew(shown, linkedSetOf(selectedText))}</div>
                      {totalParas > visibleParas && (
                        <button
                          onClick={() => setVisibleParas((v) => v + 25)}
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: '1px dashed #67a377',
                            borderRadius: 10,
                            padding: '10px 14px',
                            color: '#96c4a0',
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 13,
                            cursor: 'pointer',
                            marginBottom: 18,
                          }}
                        >
                          Mostra altri paragrafi ({totalParas - visibleParas} rimanenti)
                        </button>
                      )}
                    </>
                  );
                })()}
                {(selectedText.linkedWords || '').trim() && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, color: '#8a7f68', fontFamily: "'Inter', sans-serif", textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                      In evidenza
                    </div>
                    <div dir="rtl" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {selectedText.linkedWords.split(',').map((w) => w.trim()).filter(Boolean).map((w) => (
                        <button
                          key={w}
                          onClick={() => lookupWord(w)}
                          style={{
                            fontFamily: "'Frank Ruhl Libre', serif",
                            fontSize: 16,
                            padding: '3px 10px',
                            borderRadius: 999,
                            border: '1px solid #e8b62a',
                            background: '#e8b62a18',
                            color: '#ffd24d',
                            cursor: 'pointer',
                          }}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selectedText.translation && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: '#8a7f68', fontFamily: "'Inter', sans-serif", textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                      Traduzione
                    </div>
                    <div style={{ fontSize: 15, color: '#dcd2b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {selectedText.translation}
                    </div>
                  </div>
                )}
                {selectedText.notes && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#8a7f68', fontFamily: "'Inter', sans-serif", textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                      Note
                    </div>
                    <div style={{ fontSize: 14, color: '#cfc4a8', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: "'Inter', sans-serif" }}>
                      {selectedText.notes}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Word Lookup Popup */}
      {wordLookup && (
        <div
          onClick={() => setWordLookup(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: '#00000099',
            zIndex: 50,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="keter-scroll"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '60vh',
              overflowY: 'auto',
              background: '#0e1a13',
              border: '1px solid #e8b62a',
              borderBottom: 'none',
              borderRadius: '18px 18px 0 0',
              padding: '18px 20px 30px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div dir="rtl" style={{ fontSize: 24, fontFamily: "'Frank Ruhl Libre', serif", color: '#ffd24d' }}>
                {wordLookup.raw.replace(/[^\u0590-\u05FF"'׳״־]/g, '')}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {selectedText && (
                  <button
                    onClick={() => toggleLinkedWord(wordLookup.word)}
                    style={{
                      background: wordInSet(wordLookup.word, linkedSetOf(selectedText)) ? '#e8b62a22' : 'none',
                      border: '1px solid #e8b62a',
                      borderRadius: 8,
                      color: '#ffd24d',
                      padding: '5px 10px',
                      fontSize: 11,
                      fontFamily: "'Inter', sans-serif",
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {wordInSet(wordLookup.word, linkedSetOf(selectedText)) ? '★ In evidenza' : '☆ Evidenzia nel testo'}
                  </button>
                )}
                <button
                  onClick={() => setWordLookup(null)}
                  style={{ background: 'none', border: 'none', color: '#8a7f68', cursor: 'pointer', padding: 6 }}
                  aria-label="Chiudi"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {wordLookup.matches.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {wordLookup.matches.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      setWordLookup(null);
                      openEntry(e);
                    }}
                    style={{
                      textAlign: 'left',
                      background: '#28442a',
                      border: '1px solid #457a54',
                      borderRadius: 10,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <div dir="rtl" style={{ fontSize: 18, fontFamily: "'Frank Ruhl Libre', serif", color: '#f0e4c8', flexShrink: 0 }}>
                      {e.Parola}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: '#e8b62a', fontFamily: "'Inter', sans-serif", minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.Traduzione || ''}
                    </div>
                    <ChevronRight size={15} color="#96c4a0" style={{ flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 14, color: '#a89c81', fontFamily: "'Inter', sans-serif", marginBottom: 12 }}>
                  Nessuna voce trovata nel Lessico per «{wordLookup.word}».
                </div>
                <button
                  onClick={() => {
                    setWordLookup(null);
                    closeTextModal();
                    setView('lexicon');
                    setActiveTag('all');
                    setQuery(wordLookup.word);
                  }}
                  style={{
                    width: '100%',
                    background: '#e8b62a22',
                    border: '1px solid #e8b62a',
                    borderRadius: 8,
                    color: '#ffd24d',
                    padding: '10px',
                    fontSize: 14,
                    fontFamily: "'Inter', sans-serif",
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Search size={15} /> Cerca nel Lessico
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Publish / Export Edits Modal */}
      {editsPanel === 'export' && (
        <div
          onClick={() => setEditsPanel(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000000cc',
            zIndex: 40,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="keter-scroll"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '86vh',
              overflowY: 'auto',
              background: '#0e1a13',
              border: '1px solid #67a377',
              borderBottom: 'none',
              borderRadius: '18px 18px 0 0',
              padding: '20px 20px 32px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontFamily: "'Frank Ruhl Libre', serif", color: '#f0e4c8' }}>
                Modifiche in sospeso · {pendingCount}
                <span style={{ fontSize: 11, color: '#8a7f68', fontFamily: "'Inter', sans-serif", marginLeft: 10 }}>
                  v{KETER_VERSION}
                </span>
              </div>
              <button
                onClick={() => setEditsPanel(null)}
                style={{ background: 'none', border: 'none', color: '#8a7f68', cursor: 'pointer', padding: 6 }}
                aria-label="Chiudi"
              >
                <X size={18} />
              </button>
            </div>

            {publishState === 'published' ? (
              <div style={{ fontSize: 14, color: '#96c4a0', fontFamily: "'Inter', sans-serif", lineHeight: 1.7 }}>
                ✓ Modifiche pubblicate nel repository. Il sito si aggiorna da solo entro un paio di minuti; gli altri dispositivi le riceveranno alla prossima apertura dell'app.
              </div>
            ) : pendingCount === 0 ? (
              <div style={{ fontSize: 13, color: '#a89c81', fontFamily: "'Inter', sans-serif" }}>
                Nessuna modifica in questa sessione. Crea o modifica una voce del lessico o un testo e la troverai qui, pronta da pubblicare.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#a89c81', marginBottom: 12, fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
                  Le voci del lessico, i testi e gli articoli creati, modificati o eliminati in questa sessione. «Pubblica su GitHub» li salva in modo permanente nel repository (file modifiche.json), rendendoli disponibili su tutti i dispositivi. In alternativa puoi copiare il JSON come copia di riserva.
                </div>
                <button
                  onClick={publishToGithub}
                  disabled={publishState === 'publishing'}
                  style={{
                    width: '100%',
                    background: '#e8b62a',
                    border: '1px solid #e8b62a',
                    borderRadius: 8,
                    color: '#1a2b20',
                    fontWeight: 600,
                    padding: '11px',
                    fontSize: 14,
                    fontFamily: "'Inter', sans-serif",
                    cursor: publishState === 'publishing' ? 'wait' : 'pointer',
                    opacity: publishState === 'publishing' ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  <Upload size={15} /> {publishState === 'publishing' ? 'Pubblico…' : 'Pubblica su GitHub'}
                </button>
                {publishState === 'error' && (
                  <div style={{ fontSize: 12, color: '#c98f4b', marginBottom: 10, fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }}>
                    Pubblicazione fallita: {publishError}
                  </div>
                )}
                <textarea
                  readOnly
                  value={JSON.stringify(exportPayload, null, 2)}
                  rows={10}
                  onFocus={(e) => e.target.select()}
                  style={{
                    width: '100%',
                    background: '#142218',
                    border: '1px solid #67a377',
                    borderRadius: 8,
                    color: '#ece4d3',
                    fontSize: 13,
                    padding: '10px',
                    fontFamily: "'Inter', monospace",
                    resize: 'vertical',
                    marginBottom: 10,
                  }}
                />
                <button
                  onClick={copyEditsJson}
                  style={{
                    width: '100%',
                    background: '#e8b62a22',
                    border: '1px solid #e8b62a',
                    borderRadius: 8,
                    color: '#ffd24d',
                    padding: '10px',
                    fontSize: 14,
                    fontFamily: "'Inter', sans-serif",
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Download size={15} /> {editsCopied ? 'Copiato ✓' : 'Copia JSON'}
                </button>
              </>
            )}

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button
                onClick={() => getGithubToken(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#67a377',
                  fontSize: 11,
                  fontFamily: "'Inter', sans-serif",
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Imposta o cambia il token GitHub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Edits Modal */}
      {editsPanel === 'import' && (
        <div
          onClick={() => setEditsPanel(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000000cc',
            zIndex: 40,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="keter-scroll"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '86vh',
              overflowY: 'auto',
              background: '#0e1a13',
              border: '1px solid #67a377',
              borderBottom: 'none',
              borderRadius: '18px 18px 0 0',
              padding: '20px 20px 32px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontFamily: "'Frank Ruhl Libre', serif", color: '#f0e4c8' }}>
                Importa modifiche
              </div>
              <button
                onClick={() => setEditsPanel(null)}
                style={{ background: 'none', border: 'none', color: '#8a7f68', cursor: 'pointer', padding: 6 }}
                aria-label="Chiudi"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 13, color: '#a89c81', marginBottom: 12, fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
              Incolla il JSON esportato da una sessione precedente. Accetta sia il nuovo formato {'{ lessico, testi }'} sia il vecchio (oggetto id → voce). Le modifiche verranno riapplicate e potrai poi pubblicarle.
            </div>

            <textarea
              value={editsImportText}
              onChange={(e) => setEditsImportText(e.target.value)}
              placeholder={'{\n  "42": { "id": 42, "Parola": "...", "Traduzione": "..." }\n}'}
              rows={12}
              style={{
                width: '100%',
                background: '#142218',
                border: '1px solid #67a377',
                borderRadius: 8,
                color: '#ece4d3',
                fontSize: 13,
                padding: '10px',
                fontFamily: "'Inter', monospace",
                resize: 'vertical',
                marginBottom: 10,
              }}
            />

            {editsImportError && (
              <div style={{ fontSize: 13, color: '#c98f4b', marginBottom: 10, fontFamily: "'Inter', sans-serif" }}>
                {editsImportError}
              </div>
            )}

            <button
              onClick={submitEditsImport}
              style={{
                width: '100%',
                background: '#e8b62a22',
                border: '1px solid #e8b62a',
                borderRadius: 8,
                color: '#ffd24d',
                padding: '10px',
                fontSize: 14,
                fontFamily: "'Inter', sans-serif",
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Upload size={15} /> Applica modifiche
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// Avvio dell'app
ReactDOM.createRoot(document.getElementById('root')).render(<Keter />);
const splash = document.getElementById('splash');
if (splash) splash.remove();
