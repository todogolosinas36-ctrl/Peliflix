/**
 * ============================================================================
 * Peloflix â€” LÃ³gica de aplicaciÃ³n
 * ============================================================================
 * Interfaz de streaming optimizada para Smart TV (Android TV, WebOS, Tizen) y
 * pantallas tÃ¡ctiles.
 *
 * Principios de navegaciÃ³n en esta app:
 *  - En un TV el foco ES el cursor: todo elemento interactivo es alcanzable
 *    con las flechas y se auto-centra al recibir foco.
 *  - Nada depende exclusivamente de `:hover`.
 *  - "Volver" / Escape siempre sube un nivel: player â†’ modal â†’ sidebar â†’ app.
 *
 * @module Peloflix
 */

'use strict';

/* ==========================================================================
 * 1. CONFIGURACIÃ“N
 * ========================================================================== */

/**
 * Clave de API por defecto. Se puede sobreescribir desde Ajustes (localStorage).
 * @type {string}
 */
const API_KEY = 'TU_API_KEY_AQUI';

/** Clave bajo la que se persiste la API key. */
const STORAGE_KEY = 'peloflix_tmdb_api_key';

const CONFIG = {
  /** Resuelve la API key activa con prioridad a localStorage. */
  getApiKey() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim();
    if (API_KEY && API_KEY !== 'TU_API_KEY_AQUI' && API_KEY.trim()) return API_KEY.trim();
    return '';
  },

  BASE_URL: 'https://api.themoviedb.org/3',
  IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/w500',
  BACKDROP_BASE_URL: 'https://image.tmdb.org/t/p/original',
  LANGUAGE: 'es-MX',

  /**
   * Proveedores de embed.
   * `UI: true` marca los que tienen botÃ³n en el reproductor â€” el ciclo
   * automÃ¡tico del botÃ³n "Cambiar" solo recorre estos para no dejar al
   * usuario en un servidor sin forma de volver.
   */
  SERVERS: {
    unlimplay: {
      name: 'UNLIMPLAY',
      label: 'Multilenguaje',
      badge: 'Multi',
      badgeClass: 'badge-multi',
      getMovieUrl: (id) => `https://unlimplay.com/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://unlimplay.com/embed/tv/${id}/${s}/${e}`
    },
    embed_su: {
      name: 'Embed.su',
      label: 'Multilenguaje',
      badge: 'Multi',
      badgeClass: 'badge-multi',
      getMovieUrl: (id) => `https://embed.su/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`
    },
    multiembed: {
      name: 'MultiEmbed',
      label: 'Latino / Multi',
      badge: 'Latino',
      badgeClass: 'badge-latino',
      getMovieUrl: (id) => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1`,
      getTvUrl: (id, s, e) => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&s=${s}&e=${e}`
    }
  },

  /** Orden de rotaciÃ³n del botÃ³n "Cambiar". */
  get SERVER_CYCLE() {
    return Object.keys(this.SERVERS);
  },

  /** Poster de reserva cuando TMDb no devuelve imagen. */
  FALLBACK_POSTER: 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">' +
    '<rect fill="#2f2f2f" width="300" height="450"/>' +
    '<text fill="#808080" font-family="sans-serif" font-size="26" font-weight="bold" ' +
    'x="50%" y="50%" text-anchor="middle">Peloflix</text></svg>'
  ),

  /** Genera un logo de reserva con el nombre del canal. */
  fallbackLogo(name, width = 300, height = 300) {
    const label = String(name).replace(/[<>&"']/g, '');
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<rect fill="#232323" width="${width}" height="${height}"/>` +
      `<text fill="#E50914" font-family="sans-serif" font-size="${Math.round(width / 12)}" font-weight="bold" ` +
      `x="50%" y="50%" text-anchor="middle">${label}</text></svg>`
    );
  }
};

/* ==========================================================================
 * 2. ESTADO GLOBAL
 * ========================================================================== */

const state = {
  /** PestaÃ±a activa: 'movie' | 'tv' | 'anime' | 'cartoons' | 'live' */
  currentTab: 'movie',
  currentPage: 1,
  totalPages: 1,
  featuredHeroItem: null,
  activeItemDetails: null,
  lastFocusedElement: null,

  /** Proveedor de embed seleccionado para la reproducciÃ³n actual. */
  selectedServer: 'unlimplay',
  /** Temporada visible en el selector de episodios. */
  activeSeason: 1,

  /** Estado del explorador de gÃ©neros. */
  explorer: {
    activeGenreId: null,
    currentPage: 1,
    totalPages: 1
  },

  /**
   * Tokens de concurrencia. Cada navegaciÃ³n asÃ­ncrona captura el valor actual
   * y lo compara al resolver: si cambiÃ³, su respuesta se descarta. Sin esto,
   * una bÃºsqueda lenta puede pisar los resultados de una mÃ¡s reciente.
   */
  tokens: {
    tab: 0,
    search: 0,
    modal: 0,
    episodes: 0,
    explorer: 0,
    rows: 0
  }
};

/** Filas del layout tipo Netflix para la pestaÃ±a PelÃ­culas. */
const HOME_ROWS = [
  {
    scrollId: 'row-scroll-estrenos',
    endpoint: '/discover/movie',
    params: () => ({
      primary_release_year: new Date().getFullYear(),
      sort_by: 'popularity.desc'
    })
  },
  {
    scrollId: 'row-scroll-accion',
    endpoint: '/discover/movie',
    params: () => ({ with_genres: 28, sort_by: 'popularity.desc' })
  },
  {
    scrollId: 'row-scroll-comedia',
    endpoint: '/discover/movie',
    params: () => ({ with_genres: 35, sort_by: 'popularity.desc' })
  },
  {
    scrollId: 'row-scroll-terror',
    endpoint: '/discover/movie',
    params: () => ({ with_genres: 27, sort_by: 'popularity.desc' })
  }
];

/** GÃ©neros de TMDb para el explorador. */
const TMDB_GENRES = [
  { id: 28, name: 'AcciÃ³n', icon: 'fa-solid fa-explosion' },
  { id: 12, name: 'Aventura', icon: 'fa-solid fa-mountain-sun' },
  { id: 16, name: 'AnimaciÃ³n', icon: 'fa-solid fa-wand-magic-sparkles' },
  { id: 35, name: 'Comedia', icon: 'fa-solid fa-face-laugh-squint' },
  { id: 80, name: 'Crimen', icon: 'fa-solid fa-user-secret' },
  { id: 99, name: 'Documental', icon: 'fa-solid fa-clapperboard' },
  { id: 18, name: 'Drama', icon: 'fa-solid fa-masks-theater' },
  { id: 10751, name: 'Familia', icon: 'fa-solid fa-people-roof' },
  { id: 14, name: 'FantasÃ­a', icon: 'fa-solid fa-hat-wizard' },
  { id: 36, name: 'Historia', icon: 'fa-solid fa-landmark' },
  { id: 27, name: 'Terror', icon: 'fa-solid fa-ghost' },
  { id: 10402, name: 'MÃºsica', icon: 'fa-solid fa-music' },
  { id: 9648, name: 'Misterio', icon: 'fa-solid fa-magnifying-glass' },
  { id: 10749, name: 'Romance', icon: 'fa-solid fa-heart' },
  { id: 878, name: 'Ciencia FicciÃ³n', icon: 'fa-solid fa-rocket' },
  { id: 53, name: 'Suspense', icon: 'fa-solid fa-bolt' },
  { id: 10752, name: 'Guerra', icon: 'fa-solid fa-shield-halved' },
  { id: 37, name: 'Western', icon: 'fa-solid fa-hat-cowboy' }
];

/* ==========================================================================
 * 3. REFERENCIAS AL DOM
 * ========================================================================== */

const dom = {
  header: document.getElementById('main-header'),
  brandLogo: document.getElementById('brand-logo'),
  headerSearchBtn: document.getElementById('header-search-btn'),
  headerSettingsBtn: document.getElementById('header-settings-btn'),
  rowYearLabel: document.getElementById('row-year-label'),

  subNavbar: document.getElementById('sub-navbar'),
  navTabButtons: document.querySelectorAll('.nav-tab-btn'),

  // BÃºsqueda
  searchModal: document.getElementById('search-modal'),
  searchModalCloseBtn: document.getElementById('search-modal-close-btn'),
  modalSearchInput: document.getElementById('modal-search-input'),
  modalClearSearchBtn: document.getElementById('modal-clear-search-btn'),
  searchResultsGrid: document.getElementById('search-results-grid'),
  searchStatusText: document.getElementById('search-status-text'),
  searchModalLoader: document.getElementById('search-modal-loader'),

  // Hero
  heroBanner: document.getElementById('hero-banner'),
  heroBackdrop: document.getElementById('hero-backdrop'),
  heroTitle: document.getElementById('hero-title'),
  heroMeta: document.getElementById('hero-meta'),
  heroOverview: document.getElementById('hero-overview'),
  heroPlayBtn: document.getElementById('hero-play-btn'),
  heroInfoBtn: document.getElementById('hero-info-btn'),

  // Filas Netflix
  homeRowsContainer: document.getElementById('home-rows-container'),
  exploreAllBtn: document.getElementById('explore-all-btn'),

  // CatÃ¡logo
  catalogSection: document.getElementById('catalog-section'),
  sectionTitle: document.getElementById('section-title'),
  sectionSubtitle: document.getElementById('section-subtitle'),
  resultsCount: document.getElementById('results-count'),
  mediaGrid: document.getElementById('media-grid'),
  loader: document.getElementById('loader'),
  loadMoreBtn: document.getElementById('load-more-btn'),

  // Explorador
  categoryExplorer: document.getElementById('category-explorer'),
  explorerBackBtn: document.getElementById('explorer-back-btn'),
  genreBtnGrid: document.getElementById('genre-btn-grid'),
  explorerResultsTitle: document.getElementById('explorer-results-title'),
  explorerLoader: document.getElementById('explorer-loader'),
  exploreGrid: document.getElementById('explore-grid'),
  exploreLoadMoreBtn: document.getElementById('explore-load-more-btn'),

  // Modal de tÃ­tulo
  mediaModal: document.getElementById('media-modal'),
  modalCloseBtn: document.getElementById('modal-close-btn'),
  modalHeroCover: document.getElementById('modal-hero-cover'),
  modalPlayBtn: document.getElementById('modal-play-btn'),
  modalPoster: document.getElementById('modal-poster'),
  modalTitle: document.getElementById('modal-title'),
  modalTagline: document.getElementById('modal-tagline'),
  modalRating: document.getElementById('modal-rating'),
  modalYear: document.getElementById('modal-year'),
  modalDuration: document.getElementById('modal-duration'),
  modalType: document.getElementById('modal-type'),
  modalGenres: document.getElementById('modal-genres'),
  modalOverview: document.getElementById('modal-overview'),

  // Reproductor
  modalPlayerSection: document.getElementById('modal-player-section'),
  playerTopBar: document.getElementById('player-top-bar'),
  playerPlayingTitle: document.getElementById('player-playing-title'),
  serverBtnGroup: document.getElementById('server-btn-group'),
  videoSourcesContainer: document.getElementById('video-sources-container'),
  quickSwitchServerBtn: document.getElementById('quick-switch-server-btn'),
  serverActiveBadge: document.getElementById('server-active-badge'),
  serverBadgeText: document.getElementById('server-badge-text'),
  playerCloseViewBtn: document.getElementById('player-close-view-btn'),
  videoPlayerIframe: document.getElementById('video-player'),
  liveTvPlayer: document.getElementById('liveTvPlayer'),

  // Episodios
  modalTvEpisodes: document.getElementById('modal-tv-episodes'),
  seasonSelect: document.getElementById('season-select'),
  episodesLoader: document.getElementById('episodes-loader'),
  episodesContainer: document.getElementById('episodes-container'),

  toast: document.getElementById('toast')
};

/** Instancia de HLS.js para TV en vivo. */
let hlsInstance = null;
/** Temporizador de auto-ocultado de la barra del reproductor. */
let playerControlsTimer = null;
/** Referencia al <script> de HLS.js, para no duplicarlo. */
let hlsLoadingPromise = null;

/* ==========================================================================
 * 4. UTILIDADES
 * ========================================================================== */

const PLAYER_CONTROLS_TIMEOUT_MS = 3000;

/**
 * Enfoca un elemento y lo centra en pantalla (lectura a 3 metros en TV).
 * @param {HTMLElement|null} element
 */
function focusAndCenter(element) {
  if (!element) return;
  element.focus({ preventScroll: true });
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
}

/**
 * Retrasa la ejecuciÃ³n de una funciÃ³n.
 * @template {Function} T
 * @param {T} fn
 * @param {number} delay
 * @returns {T & {cancel: () => void}}
 */
function debounce(fn, delay = 350) {
  let timer;
  const wrapped = function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

/**
 * Crea un elemento con clase y texto en una sola llamada.
 * Evita `innerHTML` con datos remotos.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function makeEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

/**
 * Crea un icono de Font Awesome.
 * @param {string} iconClass
 * @returns {HTMLElement}
 */
function makeIcon(iconClass) {
  const i = document.createElement('i');
  i.className = iconClass;
  i.setAttribute('aria-hidden', 'true');
  return i;
}

/**
 * AÃ±ade un icono + texto a un contenedor.
 * @param {HTMLElement} parent
 * @param {string} iconClass
 * @param {string} text
 */
function appendIconText(parent, iconClass, text) {
  parent.appendChild(makeIcon(iconClass));
  parent.appendChild(document.createTextNode(` ${text}`));
}

/**
 * Extrae el aÃ±o de una fecha ISO.
 * @param {string} [dateStr]
 * @returns {string}
 */
function formatYear(dateStr) {
  return dateStr ? String(dateStr).substring(0, 4) : 'N/D';
}

/**
 * Normaliza un resultado de TMDb a un tÃ­tulo reproducible.
 * @param {object} item
 * @returns {{id: number, title: string, mediaType: string, year: string, rating: string, overview: string, poster: string, backdrop: string}|null}
 */
function normalizeItem(item) {
  if (!item || item.media_type === 'person') return null;
  if (!item.id || (!item.title && !item.name)) return null;

  // TMDb no siempre incluye media_type en /discover; se deduce por la forma.
  const isMovie = item.media_type
    ? item.media_type === 'movie'
    : Boolean(item.title && !item.name);

  const title = item.title || item.name;

  return {
    id: item.id,
    title,
    mediaType: isMovie ? 'movie' : 'tv',
    typeLabel: isMovie ? 'PelÃ­cula' : 'Serie',
    year: formatYear(item.release_date || item.first_air_date),
    rating: item.vote_average ? Number(item.vote_average).toFixed(1) : 'S/R',
    overview: item.overview || '',
    poster: item.poster_path ? CONFIG.IMAGE_BASE_URL + item.poster_path : CONFIG.FALLBACK_POSTER,
    backdrop: item.backdrop_path || item.poster_path || ''
  };
}

/**
 * Â¿Este elemento estÃ¡ realmente en pantalla? (no oculto por CSS)
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function isVisible(el) {
  return Boolean(el) && el.offsetParent !== null && !el.classList.contains('hidden');
}

/**
 * Muestra un mensaje breve.
 * @param {string} message
 * @param {number} [duration]
 */
let toastTimer = null;
function showToast(message, duration = 3200) {
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.remove('hidden');
  toastTimer = setTimeout(() => dom.toast.classList.add('hidden'), duration);
}

/**
 * Bloquea o desbloquea el scroll segÃºn haya algÃºn modal abierto.
 * Se llama tras cada apertura/cierre para que el estado sea siempre correcto
 * aunque se encadenen varios modales.
 */
function syncScrollLock() {
  const modals = [dom.searchModal, dom.mediaModal];
  const anyOpen = modals.some((m) => m && !m.classList.contains('hidden'));
  document.body.style.overflow = anyOpen ? 'hidden' : '';
}

/** Muestra u oculta un elemento con la clase `hidden`. */
function toggleHidden(element, hidden) {
  if (element) element.classList.toggle('hidden', hidden);
}

/* ==========================================================================
 * 5. CAPA DE DATOS (TMDb)
 * ========================================================================== */

/**
 * PeticiÃ³n a TMDb v3.
 * @param {string} endpoint
 * @param {object} [params]
 * @returns {Promise<object>}
 * @throws {Error} NO_API_KEY | INVALID_API_KEY | HTTP <status>
 */
async function fetchFromTMDb(endpoint, params = {}) {
  const key = CONFIG.getApiKey();
  if (!key) throw new Error('NO_API_KEY');

  // URLSearchParams ya codifica los valores: no usar encodeURIComponent aquÃ­.
  const query = new URLSearchParams({
    api_key: key,
    language: CONFIG.LANGUAGE,
    ...params
  });

  const url = `${CONFIG.BASE_URL}${endpoint}?${query.toString()}`;

  let response;
  try {
    response = await fetch(url);
  } catch (networkError) {
    throw new Error('NETWORK_ERROR');
  }

  if (response.status === 401) throw new Error('INVALID_API_KEY');
  if (!response.ok) throw new Error(`HTTP_${response.status}`);

  return response.json();
}

/** @param {number} page */
const getSeries = (page = 1) =>
  fetchFromTMDb('/discover/tv', { sort_by: 'popularity.desc', page });

/**
 * Anime: TMDb v3 solo expone `with_original_language` en /discover/tv.
 * @param {number} page
 */
const getAnime = (page = 1) =>
  fetchFromTMDb('/discover/tv', {
    with_original_language: 'ja',
    with_genres: '16',
    sort_by: 'popularity.desc',
    page
  });

/**
 * AnimaciÃ³n occidental. No existe un parÃ¡metro "sin idioma originals" en la
 * v3, asÃ­ que se pide toda la animaciÃ³n y se descarta el anime en cliente
 * (evita duplicar la pestaÃ±a "Anime").
 * @param {number} page
 */
async function getCartoons(page = 1) {
  const data = await fetchFromTMDb('/discover/tv', {
    with_genres: '16',
    sort_by: 'popularity.desc',
    page
  });
  data.results = (data.results || []).filter(
    (i) => i.original_language && i.original_language !== 'ja'
  );
  return data;
}

/**
 * BÃºsqueda multilenguaje.
 * @param {string} query
 * @param {number} [page]
 */
const searchMulti = (query, page = 1) =>
  fetchFromTMDb('/search/multi', { query, page, include_adult: false });

/** @param {string} mediaType @param {number} id */
const getMediaDetails = (mediaType, id) => fetchFromTMDb(`/${mediaType}/${id}`);

/** @param {number} tvId @param {number} seasonNumber */
const getSeasonEpisodes = (tvId, seasonNumber) =>
  fetchFromTMDb(`/tv/${tvId}/season/${seasonNumber}`);

/* ==========================================================================
 * 6. DATOS DE DEMOSTRACIÃ“N (fallback sin API key)
 * ========================================================================== */

const DEMO_ITEMS = [
  {
    id: 157336, title: 'Interstellar', media_type: 'movie', category: 'movie',
    overview: 'Un grupo de cientÃ­ficos y exploradores viajan a travÃ©s de un agujero de gusano para encontrar un nuevo hogar para la humanidad.',
    poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', backdrop_path: '/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
    vote_average: 8.4, release_date: '2014-11-05'
  },
  {
    id: 693134, title: 'Dune: Parte Dos', media_type: 'movie', category: 'movie',
    overview: 'Paul Atreides se une a Chani y a los Fremen mientras busca venganza contra los conspiradores que destruyeron a su familia.',
    poster_path: '/8b8R8l88Qje9dn9OE8PY05Nx1S8.jpg', backdrop_path: '/xOMo8BRK7PfcJv9JCnx7s520048.jpg',
    vote_average: 8.2, release_date: '2024-02-27'
  },
  {
    id: 155, title: 'The Dark Knight', media_type: 'movie', category: 'movie',
    overview: 'Batman debe aceptar uno de los mayores desafÃ­os de su capacidad para luchar contra el Joker.',
    poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', backdrop_path: '/dqK9Hag1054tghRQSqLSfrkvQnA.jpg',
    vote_average: 8.5, release_date: '2008-07-16'
  },
  {
    id: 872585, title: 'Oppenheimer', media_type: 'movie', category: 'movie',
    overview: 'La historia del fÃ­sico J. Robert Oppenheimer y su liderazgo en el Proyecto Manhattan.',
    poster_path: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', backdrop_path: '/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg',
    vote_average: 8.1, release_date: '2023-07-19'
  },
  {
    id: 66732, name: 'Stranger Things', title: 'Stranger Things', media_type: 'tv', category: 'tv',
    overview: 'Tras la misteriosa desapariciÃ³n de un niÃ±o, un pueblo descubre un secreto con experimentos clasificados.',
    poster_path: '/49WJfeN0moxb9IPfGn8AIqMGskD.jpg', backdrop_path: '/56v2KjBlU4XaOv9rVYEQypROD7P.jpg',
    vote_average: 8.6, first_air_date: '2016-07-15', number_of_seasons: 4
  },
  {
    id: 1399, name: 'Game of Thrones', title: 'Juego de Tronos', media_type: 'tv', category: 'tv',
    overview: 'Siete familias nobles luchan por el control de la mÃ­tica tierra de Poniente.',
    poster_path: '/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg', backdrop_path: '/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg',
    vote_average: 8.4, first_air_date: '2011-04-17', number_of_seasons: 8
  },
  {
    id: 1396, name: 'Breaking Bad', title: 'Breaking Bad', media_type: 'tv', category: 'tv',
    overview: 'Un profesor de quÃ­mica con cÃ¡ncer terminal recurre a la fabricaciÃ³n de metanfetamina.',
    poster_path: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', backdrop_path: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
    vote_average: 8.9, first_air_date: '2008-01-20', number_of_seasons: 5
  },
  {
    id: 1429, name: 'Attack on Titan', title: 'Ataque a los Titanes', media_type: 'tv', category: 'anime',
    overview: 'La humanidad vive dentro de ciudades rodeadas por enormes muros que los protegen de los Titanes.',
    poster_path: '/aiy35EvapPV79Q87zyiyYKdwAI.jpg', backdrop_path: '/y74tlGv7z4EFTj8i2Zq60jIqjP.jpg',
    vote_average: 8.9, first_air_date: '2013-04-07', number_of_seasons: 4
  },
  {
    id: 85937, name: 'Demon Slayer', title: 'Demon Slayer', media_type: 'tv', category: 'anime',
    overview: 'Tanjiro Kamado emprende un viaje para vengar a su familia asesinada.',
    poster_path: '/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg', backdrop_path: '/nTvM4mhqZlHIvUkI1gVnWumQU84.jpg',
    vote_average: 8.7, first_air_date: '2019-04-06', number_of_seasons: 4
  },
  {
    id: 12971, name: 'Dragon Ball Z', title: 'Dragon Ball Z', media_type: 'tv', category: 'anime',
    overview: 'Goku y los Guerreros Z defienden la Tierra de poderosos villanos galÃ¡cticos.',
    poster_path: '/dBsjo54k9zF4AocHwL7Hj03bJ3n.jpg', backdrop_path: '/f53JvlEgqvVoq7Tz6p6u8Y0NdrM.jpg',
    vote_average: 8.3, first_air_date: '1989-04-26', number_of_seasons: 9
  },
  {
    id: 60625, name: 'Rick and Morty', title: 'Rick y Morty', media_type: 'tv', category: 'cartoons',
    overview: 'Un cientÃ­fico brillante pero alcohÃ³lico y su nieto viajan por dimensiones infinitas.',
    poster_path: '/cvhNj9eoRBe5SxjardzrVZNTISn.jpg', backdrop_path: '/uK9uV0j2J8eK7s6W6t8M9Qe9z6M.jpg',
    vote_average: 8.7, first_air_date: '2013-12-02', number_of_seasons: 7
  },
  {
    id: 94605, name: 'Arcane', title: 'Arcane', media_type: 'tv', category: 'cartoons',
    overview: 'Dos hermanas en bandos opuestos de una guerra tecnolÃ³gica entre PiltÃ³ver y Zaun.',
    poster_path: '/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg', backdrop_path: '/v4y1m1scvK4x2K0tqL68Xm8Pj6J.jpg',
    vote_average: 8.7, first_air_date: '2021-11-06', number_of_seasons: 2
  },
  {
    id: 456, name: 'The Simpsons', title: 'Los Simpson', media_type: 'tv', category: 'cartoons',
    overview: 'Las sÃ¡tiras y aventuras de la emblemÃ¡tica familia Simpson.',
    poster_path: '/k55w9T3m72qV3xG3f2y6f4g.jpg', backdrop_path: '/hpU2cHC9tk90hG7neKaCVNm7DY.jpg',
    vote_average: 8.0, first_air_date: '1989-12-17', number_of_seasons: 35
  }
];

/** Canales de TV en vivo. Sustituye `stream_url` por tu .m3u8. */
const LIVE_CHANNELS = [
  {
    id: 'tv1', number: 1, name: 'Telefe', category: 'Nacional',
    description: 'TransmisiÃ³n oficial de televisiÃ³n en directo, sin cortes.',
    logo: '', stream_url: 'URL_M3U8_AQUI'
  },
  {
    id: 'tv2', number: 2, name: 'TV PÃºblica', category: 'Nacional',
    description: 'SeÃ±al en directo de la tv pÃºblica, 24 horas.',
    logo: '', stream_url: 'URL_M3U8_AQUI'
  },
  {
    id: 'tv3', number: 3, name: 'Canal 10 TucumÃ¡n', category: 'Regional',
    description: 'TelevisiÃ³n regional en directo.',
    logo: '', stream_url: 'URL_M3U8_AQUI'
  }
];

/* ==========================================================================
 * 7. RENDER â€” HERO
 * ========================================================================== */

/**
 * Pinta el banner principal.
 * @param {object} item TÃ­tulo normalizado, o null para el canal destacado.
 */
function renderHero(item) {
  if (!item) return;

  state.featuredHeroItem = item;

  const isLive = Boolean(item.isLiveChannel);
  const typeLabel = isLive ? (item.category || 'En vivo') : item.typeLabel;

  // Fondo
  if (isLive) {
    dom.heroBackdrop.style.backgroundImage =
      'radial-gradient(circle at 50% 40%, #2a1518 0%, #141414 70%)';
  } else {
    const backdropUrl = item.backdrop
      ? (item.backdrop.startsWith('/')
          ? CONFIG.BACKDROP_BASE_URL + item.backdrop
          : CONFIG.IMAGE_BASE_URL + item.backdrop)
      : CONFIG.FALLBACK_POSTER;
    dom.heroBackdrop.style.backgroundImage = `url("${backdropUrl}")`;
  }

  // TÃ­tulo: texto plano, sin etiquetas ni cajas.
  dom.heroTitle.textContent = isLive ? `${item.title} en vivo` : item.title;

  // Metadatos: solo texto. Sin badges de fondo (requisito de diseÃ±o).
  dom.heroMeta.replaceChildren();

  if (isLive) {
    const signal = makeEl('span', 'hero-rating');
    appendIconText(signal, 'fa-solid fa-signal', 'SeÃ±al HD');
    dom.heroMeta.append(signal);
    dom.heroMeta.append(makeMeta('hero-year', `Canal ${item.number ?? ''}`.trim()));
  } else {
    const rating = makeEl('span', 'hero-rating');
    appendIconText(rating, 'fa-solid fa-star', item.rating || 'â€”');
    dom.heroMeta.append(rating);
    dom.heroMeta.append(makeMeta('hero-year', item.year));
  }
  dom.heroMeta.append(makeMeta('hero-type-badge', typeLabel));

  dom.heroOverview.textContent =
    item.overview || 'Disfruta de esta producciÃ³n en alta definiciÃ³n.';

  /**
   * Metadato del hero. Solo texto: sin fondo ni borde.
   * @param {string} className
   * @param {string} text
   */
  function makeMeta(className, text) {
    return makeEl('span', className, text);
  }
}

/* ==========================================================================
 * 8. RENDER â€” TARJETAS
 * ========================================================================== */

/**
 * Contenedor de pÃ³ster con overlay de reproducciÃ³n.
 * @param {{poster: string, title: string, rating: string, typeLabel: string}} item
 * @returns {HTMLElement}
 */
function buildPosterBlock(item) {
  const wrap = makeEl('div', 'card-poster-wrapper');

  const img = document.createElement('img');
  img.className = 'card-poster';
  img.src = item.poster;
  img.alt = `Poster de ${item.title}`;
  img.loading = 'lazy';
  img.decoding = 'async';
  // Si TMDb devuelve un pÃ³ster roto, caemos al placeholder local.
  img.addEventListener('error', () => { img.src = CONFIG.FALLBACK_POSTER; }, { once: true });
  wrap.appendChild(img);

  const rating = makeEl('span', 'card-badge-rating');
  appendIconText(rating, 'fa-solid fa-star', item.rating);
  wrap.appendChild(rating);

  wrap.appendChild(makeEl('span', 'card-badge-type', item.typeLabel));

  const overlay = makeEl('div', 'card-hover-overlay');
  overlay.appendChild(makeIcon('fa-solid fa-play'));
  wrap.appendChild(overlay);

  return wrap;
}

/**
 * Bloque de metadatos bajo el pÃ³ster.
 * @param {{title: string, year: string, typeLabel: string}} item
 * @returns {HTMLElement}
 */
function buildInfoBlock(item) {
  const info = makeEl('div', 'card-info');

  const title = makeEl('h3', 'card-title', item.title);
  title.title = item.title;
  info.appendChild(title);

  const meta = makeEl('div', 'card-meta');
  meta.appendChild(makeEl('span', null, item.year));
  meta.appendChild(makeEl('span', null, item.mediaType === 'movie' ? 'Film' : 'TV'));
  info.appendChild(meta);

  return info;
}

/**
 * Tarjeta de la grilla de catÃ¡logo.
 * @param {object} item
 * @param {{onSelect?: Function}} [opts]
 * @returns {HTMLElement}
 */
function createMediaCard(item, opts = {}) {
  const data = normalizeItem(item);
  if (!data) return document.createComment('invalid-item');

  const card = document.createElement('article');
  card.className = 'media-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${data.title}, ${data.year}, calificaciÃ³n ${data.rating}`);

  card.appendChild(buildPosterBlock(data));
  card.appendChild(buildInfoBlock(data));

  const select = () => {
    if (opts.onSelect) opts.onSelect(data);
    else {
      state.lastFocusedElement = card;
      openMediaModal(data.id, data.mediaType);
    }
  };

  card.addEventListener('click', select);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select();
    }
  });
  card.addEventListener('focus', () => {
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });

  return card;
}

/**
 * Tarjeta compacta para los carruseles horizontales.
 * @param {object} item
 * @returns {HTMLElement}
 */
function createRowCard(item) {
  const data = normalizeItem(item);
  if (!data) return document.createComment('invalid-item');

  const card = document.createElement('article');
  card.className = 'row-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${data.title}, ${data.year}, calificaciÃ³n ${data.rating}`);

  // PÃ³ster
  const posterWrap = makeEl('div', 'row-card-poster-wrap');
  const img = document.createElement('img');
  img.className = 'row-card-poster';
  img.src = data.poster;
  img.alt = `Poster de ${data.title}`;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => { img.src = CONFIG.FALLBACK_POSTER; }, { once: true });
  posterWrap.appendChild(img);

  const rating = makeEl('span', 'row-card-rating');
  appendIconText(rating, 'fa-solid fa-star', data.rating);
  posterWrap.appendChild(rating);

  const overlay = makeEl('div', 'row-card-overlay');
  overlay.appendChild(makeIcon('fa-solid fa-play'));
  posterWrap.appendChild(overlay);
  card.appendChild(posterWrap);

  // Metadatos
  const info = makeEl('div', 'row-card-info');
  const title = makeEl('h3', 'row-card-title', data.title);
  title.title = data.title;
  info.appendChild(title);
  const meta = makeEl('div', 'row-card-meta');
  meta.appendChild(makeEl('span', null, data.year));
  meta.appendChild(makeEl('span', null, data.mediaType === 'movie' ? 'Film' : 'TV'));
  info.appendChild(meta);
  card.appendChild(info);

  const select = () => {
    state.lastFocusedElement = card;
    openMediaModal(data.id, data.mediaType);
  };

  card.addEventListener('click', select);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select();
    }
  });
  card.addEventListener('focus', () => {
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });

  return card;
}

/**
 * Tarjeta de canal de TV en vivo.
 * @param {object} channel
 * @param {number} index
 * @returns {HTMLElement}
 */
function createLiveChannelCard(channel, index) {
  const card = document.createElement('article');
  card.className = 'live-channel-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute(
    'aria-label',
    `${channel.name}, canal ${channel.number ?? index + 1}, ${channel.category || 'en vivo'}`
  );

  // Cabecera
  const top = makeEl('div', 'channel-card-top');
  top.appendChild(makeEl('span', 'channel-number', `CH ${channel.number ?? index + 1}`));
  const live = makeEl('span', 'channel-live-badge');
  live.appendChild(makeIcon('fa-solid fa-circle'));
  live.appendChild(document.createTextNode(' EN VIVO'));
  top.appendChild(live);
  card.appendChild(top);

  // Logo
  const logoBox = makeEl('div', 'channel-logo-container');
  const logo = document.createElement('img');
  logo.className = 'channel-logo';
  logo.alt = `Logo de ${channel.name}`;
  logo.loading = 'lazy';
  if (channel.logo) {
    logo.src = channel.logo;
    logo.addEventListener('error', () => {
      logo.src = CONFIG.fallbackLogo(channel.name, 200, 100);
    }, { once: true });
  } else {
    logo.src = CONFIG.fallbackLogo(channel.name, 200, 100);
  }
  logoBox.appendChild(logo);
  card.appendChild(logoBox);

  // Cuerpo
  const body = makeEl('div', 'channel-card-body');
  const header = makeEl('div', 'channel-header-row');
  const name = makeEl('h3', 'channel-name', channel.name);
  name.title = channel.name;
  header.appendChild(name);
  header.appendChild(makeEl('span', 'channel-category-tag', channel.category || 'Nacional'));
  body.appendChild(header);

  body.appendChild(makeEl(
    'p', 'channel-desc',
    channel.description || 'TransmisiÃ³n oficial de televisiÃ³n en directo, sin cortes.'
  ));

  const action = makeEl('div', 'channel-play-action');
  appendIconText(action, 'fa-solid fa-play', 'Sintonizar');
  body.appendChild(action);
  card.appendChild(body);

  const select = () => {
    state.lastFocusedElement = card;
    openLiveChannel(channel);
  };

  card.addEventListener('click', select);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select();
    }
  });
  card.addEventListener('focus', () => {
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });

  return card;
}

/* ==========================================================================
 * 9. RENDER â€” GRILLAS, FILAS Y SKELETONS
 * ========================================================================== */

/**
 * Muestra un estado vacÃ­o en la grilla.
 * @param {HTMLElement} grid
 * @param {{icon: string, title: string, text: string}} content
 */
function renderEmptyState(grid, { icon, title, text }) {
  const box = makeEl('div', 'search-empty-state');
  box.appendChild(makeIcon(icon));
  box.appendChild(makeEl('h3', null, title));
  box.appendChild(makeEl('p', null, text));
  grid.replaceChildren(box);
}

/**
 * Pinta la grilla del catÃ¡logo.
 * @param {object[]} items
 * @param {boolean} [append]
 */
function renderMediaGrid(items, append = false) {
  dom.mediaGrid.classList.remove('live-grid');
  if (!append) dom.mediaGrid.replaceChildren();

  const cards = items
    .map((item) => createMediaCard(item))
    .filter((node) => node.nodeType === Node.ELEMENT_NODE);

  if (cards.length === 0) {
    if (!append) {
      renderEmptyState(dom.mediaGrid, {
        icon: 'fa-solid fa-film',
        title: 'No se encontraron resultados',
        text: 'Prueba con otro tÃ­tulo o cambia de categorÃ­a desde el menÃº superior.'
      });
    }
    toggleHidden(dom.loadMoreBtn, true);
    return;
  }

  const fragment = document.createDocumentFragment();
  cards.forEach((card) => fragment.appendChild(card));
  dom.mediaGrid.appendChild(fragment);

  toggleHidden(dom.loadMoreBtn, state.currentPage >= state.totalPages);
}

/**
 * Pinta los canales de TV en vivo.
 * @param {object[]} channels
 */
function renderLiveChannels(channels) {
  dom.mediaGrid.classList.add('live-grid');
  dom.mediaGrid.replaceChildren();

  if (channels.length === 0) {
    renderEmptyState(dom.mediaGrid, {
      icon: 'fa-solid fa-tv',
      title: 'Sin canales configurados',
      text: 'AÃ±ade canales en el array LIVE_CHANNELS de app.js para verlos aquÃ­.'
    });
    toggleHidden(dom.loadMoreBtn, true);
    return;
  }

  const featured = channels[0];
  renderHero({
    isLiveChannel: true,
    id: featured.id,
    title: featured.name,
    number: featured.number,
    category: featured.category,
    overview: featured.description,
    ...featured
  });

  const fragment = document.createDocumentFragment();
  channels.forEach((channel, i) => fragment.appendChild(createLiveChannelCard(channel, i)));
  dom.mediaGrid.appendChild(fragment);

  toggleHidden(dom.loadMoreBtn, true);
}

/**
 * Skeletons de carga para la grilla.
 * @param {number} [count]
 */
function showGridSkeletons(count = 12) {
  dom.mediaGrid.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) fragment.appendChild(makeEl('div', 'card-skeleton'));
  dom.mediaGrid.appendChild(fragment);
}

/**
 * Skeletons de carga para un carrusel.
 * @param {string} scrollId
 * @param {number} [count]
 */
function showRowSkeletons(scrollId, count = 10) {
  const container = document.getElementById(scrollId);
  if (!container) return;
  container.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) fragment.appendChild(makeEl('div', 'row-card-skeleton'));
  container.appendChild(fragment);
}

/* ==========================================================================
 * 10. NAVEGACIÃ“N POR PESTAÃ‘AS
 * ========================================================================== */

/** Muestra el layout de filas y oculta la grilla. */
function showRowsLayout() {
  toggleHidden(dom.homeRowsContainer, false);
  toggleHidden(dom.catalogSection, true);
  toggleHidden(dom.categoryExplorer, true);
  toggleHidden(dom.heroBanner, false);
}

/** Muestra la grilla de catÃ¡logo y oculta las filas. */
function showCatalogLayout() {
  toggleHidden(dom.homeRowsContainer, true);
  toggleHidden(dom.catalogSection, false);
  toggleHidden(dom.categoryExplorer, true);
  toggleHidden(dom.heroBanner, false);
}

const TAB_META = {
  tv: {
    title: 'Series de TelevisiÃ³n',
    subtitle: 'Las mejores series para maratonear',
    fetch: getSeries
  },
  anime: {
    title: 'Anime JaponÃ©s',
    subtitle: 'ShÅnen, seinen y mÃ¡s animaciÃ³n japonesa',
    fetch: getAnime
  },
  cartoons: {
    title: 'Dibujos Animados',
    subtitle: 'AnimaciÃ³n occidental para toda la familia',
    fetch: getCartoons
  }
};

/**
 * Carga la pestaÃ±a indicada.
 * @param {string} tab
 * @param {number} [page]
 */
async function loadActiveTab(tab = state.currentTab, page = 1) {
  const token = ++state.tokens.tab;

  state.currentTab = tab;
  state.currentPage = page;

  dom.navTabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.category === tab);
  });

  /* --- TV en vivo: datos locales, sin red --- */
  if (tab === 'live') {
    showCatalogLayout();
    dom.sectionTitle.textContent = 'TV en Vivo';
    dom.sectionSubtitle.textContent = 'Transmisiones oficiales y seÃ±ales 24/7 sin cortes';
    dom.resultsCount.textContent = `${LIVE_CHANNELS.length} canales`;
    renderLiveChannels(LIVE_CHANNELS);
    return;
  }

  /* --- PelÃ­culas: hero + carruseles --- */
  if (tab === 'movie') {
    showRowsLayout();
    await loadHero();
    // El usuario pudo cambiar de pestaÃ±a mientras cargaba el hero.
    if (token !== state.tokens.tab) return;
    loadHomeRows();
    return;
  }

  /* --- Series / Anime / Dibujos: grilla paginada --- */
  const meta = TAB_META[tab] || TAB_META.tv;
  showCatalogLayout();
  dom.sectionTitle.textContent = meta.title;
  dom.sectionSubtitle.textContent = meta.subtitle;
  dom.resultsCount.textContent = '';

  if (page === 1) showGridSkeletons();
  else toggleHidden(dom.loader, false);

  try {
    const data = await meta.fetch(page);
    if (token !== state.tokens.tab) return; // otra navegaciÃ³n ganÃ³ la carrera

    state.totalPages = Math.min(data.total_pages || 1, 500);
    const items = data.results || [];

    if (page === 1 && items.length) renderHero(normalizeItem(items[0]));
    renderMediaGrid(items, page > 1);
    toggleHidden(dom.loadMoreBtn, state.currentPage >= state.totalPages);
  } catch (error) {
    if (token !== state.tokens.tab) return;
    console.warn(`[Peloflix] Modo demostraciÃ³n (${error.message})`);

    const demo = DEMO_ITEMS.filter((item) => item.category === tab);
    if (page === 1 && demo.length) renderHero(normalizeItem(demo[0]));
    renderMediaGrid(demo, false);
    toggleHidden(dom.loadMoreBtn, true);
  } finally {
    if (token === state.tokens.tab) toggleHidden(dom.loader, true);
  }
}

/** Carga el tÃ­tulo destacado del hero para la pestaÃ±a PelÃ­culas. */
async function loadHero() {
  try {
    if (!CONFIG.getApiKey()) throw new Error('NO_API_KEY');
    const data = await fetchFromTMDb('/trending/movie/week', { page: 1 });
    const first = (data.results || []).find((i) => i.title);
    if (first) renderHero(normalizeItem(first));
  } catch {
    const demo = DEMO_ITEMS.find((item) => item.category === 'movie');
    if (demo) renderHero(normalizeItem(demo));
  }
}

/**
 * Carga los 4 carruseles en paralelo. Cada fila es independiente: un fallo
 * en una no arrastra a las demÃ¡s.
 */
function loadHomeRows() {
  const token = ++state.tokens.rows;

  // El aÃ±o del rÃ³tulo sigue al calendario real.
  if (dom.rowYearLabel) dom.rowYearLabel.textContent = new Date().getFullYear();

  HOME_ROWS.forEach((row) => showRowSkeletons(row.scrollId));

  const requests = HOME_ROWS.map(async (row) => {
    const container = document.getElementById(row.scrollId);
    if (!container) return;

    try {
      if (!CONFIG.getApiKey()) throw new Error('NO_API_KEY');
      const data = await fetchFromTMDb(row.endpoint, { ...row.params(), page: 1 });
      if (token !== state.tokens.rows) return;

      const cards = (data.results || [])
        .map(createRowCard)
        .filter((node) => node.nodeType === Node.ELEMENT_NODE);

      container.replaceChildren();
      const fragment = document.createDocumentFragment();
      cards.forEach((card) => fragment.appendChild(card));
      container.appendChild(fragment);
    } catch {
      if (token !== state.tokens.rows) return;
      // Fallback: la lista de demostraciÃ³n da contenido aunque no haya red.
      const demo = DEMO_ITEMS.filter((item) => item.category === 'movie');
      container.replaceChildren();
      const fragment = document.createDocumentFragment();
      demo.forEach((item) => fragment.appendChild(createRowCard(item)));
      container.appendChild(fragment);
    }
  });

  Promise.allSettled(requests);
}

/* ==========================================================================
 * 11. EXPLORADOR DE GÃ‰NEROS
 * ========================================================================== */

/** Renderiza (una sola vez) los botones de gÃ©nero. */
function renderGenreButtons() {
  if (!dom.genreBtnGrid || dom.genreBtnGrid.children.length) return;

  const fragment = document.createDocumentFragment();

  TMDB_GENRES.forEach((genre) => {
    const btn = makeEl('button', 'genre-filter-btn');
    btn.type = 'button';
    btn.tabIndex = 0;
    btn.dataset.genreId = genre.id;
    appendIconText(btn, genre.icon, genre.name);

    const select = () => {
      dom.genreBtnGrid.querySelectorAll('.genre-filter-btn')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadGenreResults(genre.id, genre.name, 1);
    };

    btn.addEventListener('click', select);
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
    });
    btn.addEventListener('focus', () => {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });

    fragment.appendChild(btn);
  });

  dom.genreBtnGrid.appendChild(fragment);
}

function showCategoryExplorer() {
  toggleHidden(dom.homeRowsContainer, true);
  toggleHidden(dom.catalogSection, true);
  toggleHidden(dom.heroBanner, true);
  toggleHidden(dom.categoryExplorer, false);

  renderGenreButtons();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  setTimeout(() => {
    const first = dom.genreBtnGrid?.querySelector('.genre-filter-btn');
    if (first) focusAndCenter(first);
  }, 150);
}

function hideCategoryExplorer() {
  toggleHidden(dom.categoryExplorer, true);

  state.explorer.activeGenreId = null;
  state.explorer.currentPage = 1;
  state.explorer.totalPages = 1;

  if (dom.exploreGrid) dom.exploreGrid.replaceChildren();
  if (dom.explorerResultsTitle) {
    dom.explorerResultsTitle.textContent = 'Selecciona un gÃ©nero para explorar';
  }
  toggleHidden(dom.exploreLoadMoreBtn, true);
  dom.genreBtnGrid?.querySelectorAll('.genre-filter-btn')
    .forEach((b) => b.classList.remove('active'));

  // Vuelve a la pestaÃ±a desde la que se entrÃ³, no a "movie" hardcodeado.
  loadActiveTab(state.currentTab, 1);
}

/**
 * Carga tÃ­tulos de un gÃ©nero.
 * @param {number} genreId
 * @param {string} genreName
 * @param {number} [page]
 */
async function loadGenreResults(genreId, genreName, page = 1) {
  const token = ++state.tokens.explorer;

  state.explorer.activeGenreId = genreId;
  state.explorer.currentPage = page;

  if (dom.explorerResultsTitle) {
    dom.explorerResultsTitle.textContent = `PelÃ­culas de ${genreName}`;
  }

  if (page === 1) {
    dom.exploreGrid?.replaceChildren();
    toggleHidden(dom.explorerLoader, false);
  }

  try {
    if (!CONFIG.getApiKey()) throw new Error('NO_API_KEY');

    const data = await fetchFromTMDb('/discover/movie', {
      with_genres: genreId,
      sort_by: 'popularity.desc',
      page
    });
    if (token !== state.tokens.explorer) return;

    state.explorer.totalPages = Math.min(data.total_pages || 1, 500);

    const fragment = document.createDocumentFragment();
    (data.results || []).forEach((item) => fragment.appendChild(createMediaCard(item)));
    dom.exploreGrid.appendChild(fragment);

    toggleHidden(dom.exploreLoadMoreBtn, page >= state.explorer.totalPages);
  } catch (error) {
    if (token !== state.tokens.explorer) return;
    console.warn(`[Peloflix] Explorador en modo demostraciÃ³n (${error.message})`);
    toggleHidden(dom.explorerLoader, true);

    // Solo en la primera pÃ¡gina: en pÃ¡ginas siguientes se acumulan resultados
    // reales y no queremos mezclarlos con la demo.
    if (page === 1) {
      const fragment = document.createDocumentFragment();
      DEMO_ITEMS.filter((item) => item.category === 'movie')
        .forEach((item) => fragment.appendChild(createMediaCard(item)));
      dom.exploreGrid?.appendChild(fragment);
    }
    toggleHidden(dom.exploreLoadMoreBtn, true);
  } finally {
    if (token === state.tokens.explorer) toggleHidden(dom.explorerLoader, true);
  }
}

/* ==========================================================================
 * 12. REPRODUCTOR â€” UTILIDADES
 * ========================================================================== */

/** Â¿EstÃ¡ el reproductor visible? */
function isPlayerActive() {
  return Boolean(dom.modalPlayerSection) &&
    !dom.modalPlayerSection.classList.contains('hidden');
}

/** Solicita pantalla completa con fallbacks multidispositivo. */
function requestFullscreenSafe(element) {
  if (!element || !document.fullscreenEnabled && !document.webkitFullscreenEnabled) return;
  try {
    const request =
      element.requestFullscreen ||
      element.webkitRequestFullscreen ||
      element.mozRequestFullScreen ||
      element.msRequestFullscreen;
    if (!request) return;
    const result = request.call(element);
    if (result && typeof result.catch === 'function') {
      result.catch(() => { /* el navegador puede rechazarlo sin gesto de usuario */ });
    }
  } catch (error) {
    console.warn('[Peloflix] Pantalla completa no disponible:', error);
  }
}

/** Sale de pantalla completa si estÃ¡ activa. */
function exitFullscreenSafe() {
  try {
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    if (!active) return;
    const exit =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.mozCancelFullScreen ||
      document.msExitFullscreen;
    if (!exit) return;
    const result = exit.call(document);
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch (error) {
    console.warn('[Peloflix] No se pudo salir de pantalla completa:', error);
  }
}

/* ==========================================================================
 * 13. REPRODUCTOR â€” AUTO-OCULTADO DE CONTROLES
 * ========================================================================== */

function showPlayerControls() {
  if (!dom.playerTopBar) return;
  dom.playerTopBar.classList.remove('is-hidden', 'hidden');
}

function hidePlayerControls() {
  if (!isPlayerActive() || !dom.playerTopBar) return;

  // No ocultar si el foco estÃ¡ dentro de la barra: el usuario estÃ¡ navegÃ¡ndola.
  if (dom.playerTopBar.contains(document.activeElement)) {
    resetPlayerControlsTimer();
    return;
  }

  dom.playerTopBar.classList.add('is-hidden', 'hidden');
}

/** Reinicia la cuenta atrÃ¡s de 3s y muestra los controles. */
function resetPlayerControlsTimer() {
  if (!isPlayerActive()) return;

  showPlayerControls();
  clearTimeout(playerControlsTimer);
  playerControlsTimer = setTimeout(hidePlayerControls, PLAYER_CONTROLS_TIMEOUT_MS);
}

function clearPlayerControlsTimer() {
  clearTimeout(playerControlsTimer);
  playerControlsTimer = null;
  showPlayerControls();
}

/* ==========================================================================
 * 14. REPRODUCTOR â€” SERVIDORES
 * ========================================================================== */

/**
 * Construye la URL de embed del proveedor activo.
 * @param {object} playback
 * @returns {string}
 */
function buildEmbedUrl(playback) {
  const server = CONFIG.SERVERS[state.selectedServer] || CONFIG.SERVERS.unlimplay;
  return playback.type === 'movie'
    ? server.getMovieUrl(playback.id)
    : server.getTvUrl(playback.id, playback.season, playback.episode);
}

/** Refleja el proveedor activo en el badge y en los botones. */
function updateServerActiveBadge(serverKey) {
  const server = CONFIG.SERVERS[serverKey];
  if (!server) return;

  if (dom.serverBadgeText) {
    dom.serverBadgeText.textContent = `${server.name} â€” ${server.label}`;
  }

  dom.serverBtnGroup?.querySelectorAll('.server-btn').forEach((btn) => {
    const isActive = btn.dataset.server === serverKey;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

/**
 * Cambia de proveedor.
 * @param {string} serverKey
 */
function handleServerChange(serverKey) {
  if (!CONFIG.SERVERS[serverKey]) return;
  state.selectedServer = serverKey;
  updateServerActiveBadge(serverKey);

  if (state.activeItemDetails) {
    const playback = state.currentPlayback;
    if (playback && playback.id) {
      // Recargar el iframe es lo Ãºnico que corta el audio del proveedor previo.
      dom.videoPlayerIframe.src = buildEmbedUrl(playback);
    }
    showToast(`Fuente: ${CONFIG.SERVERS[serverKey].name}`);
  }
}

/** Rota al siguiente proveedor con botÃ³n en la interfaz. */
function cycleNextServer() {
  const keys = CONFIG.SERVER_CYCLE;
  const next = keys[(keys.indexOf(state.selectedServer) + 1) % keys.length];
  handleServerChange(next);
}

/** Muestra u oculta el selector de servidores ( irrelevante en IPTV). */
function setServerControlsVisible(visible) {
  toggleHidden(dom.videoSourcesContainer, !visible);
  toggleHidden(dom.serverActiveBadge, !visible);
  toggleHidden(dom.quickSwitchServerBtn, !visible);
}

/* ==========================================================================
 * 15. REPRODUCTOR â€” TV EN VIVO (HLS)
 * ========================================================================== */

const HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';

/**
 * Carga HLS.js bajo demanda: la pestaÃ±a "TV en Vivo" es la Ãºnica que lo
 * necesita, y pesa lo suficiente como para no bloquear el arranque.
 * @returns {Promise<void>}
 */
function loadHlsLibrary() {
  if (window.Hls) return Promise.resolve();
  if (hlsLoadingPromise) return hlsLoadingPromise;

  hlsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = HLS_CDN;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error('HLS_LOAD_FAILED')), { once: true });
    document.head.appendChild(script);
  });

  return hlsLoadingPromise;
}

/** Destruye la instancia de HLS si existe. */
function destroyHls() {
  if (!hlsInstance) return;
  try {
    hlsInstance.destroy();
  } catch (error) {
    console.warn('[Peloflix] Error destruyendo HLS:', error);
  }
  hlsInstance = null;
}

/**
 * Reproduce una transmisiÃ³n .m3u8.
 * @param {string} streamUrl
 * @param {string} channelName
 */
async function playHlsStream(streamUrl, channelName) {
  if (!dom.liveTvPlayer) return;

  destroyHls();

  if (!streamUrl || !/^https?:\/\//i.test(streamUrl)) {
    showToast(`Canal "${channelName}": reemplaza su .m3u8 en LIVE_CHANNELS (app.js).`);
    return;
  }

  try {
    await loadHlsLibrary();
  } catch {
    showToast('No se pudo cargar el reproductor HLS.');
    return;
  }

  const HlsCtor = window.Hls;
  const video = dom.liveTvPlayer;

  if (HlsCtor && HlsCtor.isSupported()) {
    hlsInstance = new HlsCtor({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 60
    });

    hlsInstance.loadSource(streamUrl);
    hlsInstance.attachMedia(video);

    hlsInstance.on(HlsCtor.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {
        showToast('Pulsa reproducir: el navegador bloqueÃ³ el inicio automÃ¡tico.');
      });
    });

    hlsInstance.on(HlsCtor.Events.ERROR, (_evt, data) => {
      if (!data.fatal) return;
      switch (data.type) {
        case HlsCtor.ErrorTypes.NETWORK_ERROR:
          console.warn('[Peloflix] Error de red HLS, reintentandoâ€¦');
          hlsInstance.startLoad();
          break;
        case HlsCtor.ErrorTypes.MEDIA_ERROR:
          console.warn('[Peloflix] Error de medios HLS, recuperandoâ€¦');
          hlsInstance.recoverMediaError();
          break;
        default:
          console.error('[Peloflix] Error fatal de HLS:', data);
          showToast(`No se pudo cargar la seÃ±al de "${channelName}".`);
          destroyHls();
      }
    });
    return;
  }

  // Safari / WebKit: HLS nativo
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = streamUrl;
    video.addEventListener('loadedmetadata', () => {
      video.play().catch(() => {});
    }, { once: true });
    return;
  }

  showToast('Este navegador no admite reproducciÃ³n HLS.');
}

/** Limpia el <video> de TV en vivo. */
function resetLiveVideo() {
  const video = dom.liveTvPlayer;
  if (!video) return;
  video.pause();
  video.removeAttribute('src');
  video.load();
  video.hidden = true;
}

/* ==========================================================================
 * 16. REPRODUCTOR â€” CICLO DE VIDA
 * ========================================================================== */

/**
 * Arranca la reproducciÃ³n de una pelÃ­cula o episodio.
 * @param {{type: 'movie'|'tv', id: number, season?: number, episode?: number, title: string}} playback
 */
function startPlayback(playback) {
  state.currentPlayback = { ...playback };

  destroyHls();
  resetLiveVideo();

  // El reproductor de embeds siempre es el iframe.
  dom.videoPlayerIframe.hidden = false;
  setServerControlsVisible(true);

  dom.playerPlayingTitle.textContent = playback.title;
  updateServerActiveBadge(state.selectedServer);

  // Asignar `src` es lo que detiene el audio del proveedor anterior.
  dom.videoPlayerIframe.src = buildEmbedUrl(state.currentPlayback);
  toggleHidden(dom.modalPlayerSection, false);

  requestFullscreenSafe(dom.modalPlayerSection);

  const activeBtn = dom.serverBtnGroup?.querySelector('.server-btn.active');
  focusAndCenter(activeBtn || dom.playerCloseViewBtn);

  resetPlayerControlsTimer();
}

/**
 * Abre un canal de TV en vivo.
 * @param {object} channel
 */
function openLiveChannel(channel) {
  if (!channel) return;

  state.lastFocusedElement = document.activeElement;
  stopAndClearPlayer();

  toggleHidden(dom.modalHeroCover, true);
  toggleHidden(dom.modalTvEpisodes, true);
  toggleHidden(dom.mediaModal, false);
  syncScrollLock();

  // IPTV: solo el <video>, sin selector de servidores.
  dom.videoPlayerIframe.hidden = true;
  dom.videoPlayerIframe.removeAttribute('src');
  dom.liveTvPlayer.hidden = false;
  setServerControlsVisible(false);

  // TÃ­tulo en la barra del reproductor, con distintivo "en directo".
  dom.playerPlayingTitle.replaceChildren();
  dom.playerPlayingTitle.append(
    makeEl('span', 'live-dot-pulse', 'ðŸ”´'),
    document.createTextNode(` ${channel.name} `),
    makeEl('span', 'badge-live-stream', 'EN DIRECTO')
  );

  // Metadatos del modal
  const channelNumber = channel.number ? ` (Canal ${channel.number})` : '';
  const description = channel.description ||
    `TransmisiÃ³n oficial de ${channel.name} en directo.`;

  dom.modalTitle.textContent = `${channel.name}${channelNumber}`;
  dom.modalTagline.textContent = `TransmisiÃ³n en vivo Â· ${channel.category || 'Nacional'}`;
  dom.modalRating.replaceChildren(makeIcon('fa-solid fa-satellite-dish'),
    document.createTextNode(' SeÃ±al HD'));
  dom.modalYear.textContent = '24/7';
  dom.modalDuration.textContent = 'En vivo';
  dom.modalType.textContent = 'IPTV';
  dom.modalOverview.textContent = description;

  const logo = channel.logo || CONFIG.fallbackLogo(channel.name);
  dom.modalPoster.src = logo;
  dom.modalPoster.onerror = null;

  dom.modalGenres.replaceChildren(
    makeEl('span', 'genre-tag', channel.category || 'Nacional'),
    makeEl('span', 'genre-tag', 'IPTV'),
    makeEl('span', 'genre-tag', 'HLS')
  );

  toggleHidden(dom.modalPlayerSection, false);
  playHlsStream(channel.stream_url, channel.name);

  setTimeout(() => requestFullscreenSafe(dom.modalPlayerSection), 120);
  resetPlayerControlsTimer();
}

/**
 * Detiene todo lo que estÃ© sonando y deja el reproductor en blanco.
 * Es el Ãºnico punto que garantiza el corte de audio:
 *  - `iframe.src = ''` desmonta el documento y corta su audio.
 *  - `hls.destroy()` cierra los workers y las peticiones de segmentos.
 */
function stopAndClearPlayer() {
  clearPlayerControlsTimer();
  exitFullscreenSafe();

  if (dom.videoPlayerIframe) {
    dom.videoPlayerIframe.removeAttribute('src');
    dom.videoPlayerIframe.hidden = false;
  }

  destroyHls();
  resetLiveVideo();

  setServerControlsVisible(true);
  toggleHidden(dom.modalPlayerSection, true);

  if (dom.playerPlayingTitle) dom.playerPlayingTitle.textContent = '';
  state.currentPlayback = { type: null, id: null, season: 1, episode: 1, title: '' };
}

/* ==========================================================================
 * 17. MODAL DE TÃTULO
 * ========================================================================== */

function closeMediaModal() {
  stopAndClearPlayer();
  toggleHidden(dom.mediaModal, true);
  toggleHidden(dom.modalHeroCover, false);
  toggleHidden(dom.modalTvEpisodes, true);
  syncScrollLock();

  state.activeItemDetails = null;

  if (state.lastFocusedElement && document.contains(state.lastFocusedElement)) {
    focusAndCenter(state.lastFocusedElement);
  }
}

/**
 * Abre el detalle de un tÃ­tulo.
 * @param {number} id
 * @param {'movie'|'tv'} mediaType
 * @param {boolean} [autoPlay]
 */
async function openMediaModal(id, mediaType, autoPlay = false) {
  const token = ++state.tokens.modal;

  stopAndClearPlayer();
  toggleHidden(dom.mediaModal, false);
  syncScrollLock();

  focusAndCenter(dom.modalPlayBtn);

  let details;
  try {
    if (CONFIG.getApiKey()) {
      details = await getMediaDetails(mediaType, id);
    } else {
      details = DEMO_ITEMS.find((item) => item.id === id) || {
        id,
        title: mediaType === 'movie' ? 'PelÃ­cula en streaming' : 'Serie en streaming',
        overview: 'Ingresa tu API Key de TMDb en ConfiguraciÃ³n para ver la ficha completa.',
        vote_average: 8.2,
        genres: [{ name: 'AcciÃ³n' }, { name: 'Aventura' }]
      };
    }
  } catch (error) {
    console.error('[Peloflix] No se pudo cargar el detalle:', error);
    showToast('No se pudieron cargar los detalles del tÃ­tulo');
    return;
  }

  // El usuario pudo abrir otro tÃ­tulo mientras esperÃ¡bamos.
  if (token !== state.tokens.modal) return;

  const isMovie = mediaType === 'movie';
  const data = normalizeItem({ ...details, media_type: mediaType, id: details.id || id });

  state.activeItemDetails = { ...details, media_type: mediaType, id: details.id || id };
  state.activeSeason = 1;

  // --- Textos ---
  dom.modalTitle.textContent = data.title;
  dom.modalTagline.textContent = details.tagline ? `â€œ${details.tagline}â€` : '';
  dom.modalRating.replaceChildren(makeIcon('fa-solid fa-star'),
    document.createTextNode(` ${data.rating}`));
  dom.modalYear.textContent = data.year;
  dom.modalDuration.textContent = isMovie
    ? (details.runtime ? `${details.runtime} min` : 'DuraciÃ³n estÃ¡ndar')
    : (details.number_of_seasons
      ? `${details.number_of_seasons} temporada(s)`
      : 'Serie de TV');
  dom.modalType.textContent = isMovie ? 'PelÃ­cula' : 'Serie';
  dom.modalOverview.textContent = data.overview || 'Sinopsis no disponible en espaÃ±ol.';

  // --- Fondo ---
  const backdropUrl = details.backdrop_path
    ? CONFIG.BACKDROP_BASE_URL + details.backdrop_path
    : (details.poster_path ? CONFIG.IMAGE_BASE_URL + details.poster_path : '');

  dom.modalHeroCover.style.backgroundImage = backdropUrl ? `url("${backdropUrl}")` : 'none';

  // --- PÃ³ster ---
  dom.modalPoster.src = details.poster_path
    ? CONFIG.IMAGE_BASE_URL + details.poster_path
    : CONFIG.FALLBACK_POSTER;
  dom.modalPoster.alt = `Poster de ${data.title}`;
  dom.modalPoster.onerror = () => {
    dom.modalPoster.onerror = null;
    dom.modalPoster.src = CONFIG.FALLBACK_POSTER;
  };

  // --- GÃ©neros ---
  dom.modalGenres.replaceChildren();
  (details.genres || []).forEach((genre) => {
    dom.modalGenres.appendChild(makeEl('span', 'genre-tag', genre.name));
  });

  // --- Episodios ---
  if (!isMovie) {
    setupTvSeriesModal(details);
  } else {
    toggleHidden(dom.modalTvEpisodes, true);
    dom.episodesContainer.replaceChildren();
  }

  // --- Autoplay ---
  if (autoPlay) {
    if (isMovie) {
      startPlayback({ type: 'movie', id: state.activeItemDetails.id, title: data.title });
    } else {
      startPlayback({
        type: 'tv', id: state.activeItemDetails.id,
        season: 1, episode: 1, title: `${data.title} Â· T1:E1`
      });
    }
  }
}

/**
 * Prepara el selector de temporadas.
 * @param {object} series
 */
function setupTvSeriesModal(series) {
  toggleHidden(dom.modalTvEpisodes, false);
  dom.seasonSelect.replaceChildren();

  const seasons = (series.seasons || []).filter((s) => s.season_number > 0);
  const totalSeasons = seasons.length || series.number_of_seasons || 1;

  for (let i = 1; i <= totalSeasons; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `Temporada ${i}`;
    dom.seasonSelect.appendChild(option);
  }
  dom.seasonSelect.value = '1';

  dom.seasonSelect.onchange = (e) => {
    const season = Number(e.target.value);
    state.activeSeason = season;
    loadSeasonEpisodes(series.id, season);
  };

  loadSeasonEpisodes(series.id, 1);
}

/**
 * Carga y pinta los episodios de una temporada.
 * @param {number} tvId
 * @param {number} seasonNumber
 */
async function loadSeasonEpisodes(tvId, seasonNumber) {
  const token = ++state.tokens.episodes;

  toggleHidden(dom.episodesLoader, false);
  dom.episodesContainer.replaceChildren();

  let episodes = [];

  try {
    if (CONFIG.getApiKey()) {
      const data = await getSeasonEpisodes(tvId, seasonNumber);
      episodes = data.episodes || [];
    } else {
      episodes = Array.from({ length: 8 }, (_, i) => ({
        episode_number: i + 1,
        name: `Episodio ${i + 1}`,
        overview: `CapÃ­tulo ${i + 1} de la temporada ${seasonNumber}.`
      }));
    }
  } catch {
    if (token !== state.tokens.episodes) return;
    toggleHidden(dom.episodesLoader, true);
    dom.episodesContainer.appendChild(makeEl(
      'p', 'channel-desc', 'No se pudieron cargar los episodios.'
    ));
    return;
  }

  if (token !== state.tokens.episodes) return;
  toggleHidden(dom.episodesLoader, true);

  if (episodes.length === 0) {
    dom.episodesContainer.appendChild(makeEl(
      'p', 'channel-desc', 'No hay episodios disponibles para esta temporada.'
    ));
    return;
  }

  const seriesTitle = dom.modalTitle.textContent;
  const fragment = document.createDocumentFragment();

  episodes.forEach((episode) => {
    const card = makeEl('article', 'episode-card');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label',
      `Episodio ${episode.episode_number}: ${episode.name || 'Sin tÃ­tulo'}`);

    // Miniatura
    const thumbWrap = makeEl('div', 'episode-thumb-wrapper');
    const thumb = document.createElement('img');
    thumb.className = 'episode-thumb';
    thumb.loading = 'lazy';
    thumb.alt = episode.name || `Episodio ${episode.episode_number}`;
    thumb.src = episode.still_path
      ? CONFIG.IMAGE_BASE_URL + episode.still_path
      : CONFIG.FALLBACK_POSTER;
    thumb.addEventListener('error', () => { thumb.src = CONFIG.FALLBACK_POSTER; }, { once: true });
    thumbWrap.appendChild(thumb);

    const playBadge = makeEl('div', 'episode-play-badge');
    playBadge.appendChild(makeIcon('fa-solid fa-play'));
    thumbWrap.appendChild(playBadge);
    card.appendChild(thumbWrap);

    // Datos
    const info = makeEl('div', 'episode-info');
    const titleRow = makeEl('div', 'episode-title-row');
    titleRow.appendChild(makeEl('span', 'episode-number', `E${episode.episode_number}`));
    const epTitle = makeEl('span', 'episode-title', episode.name || 'Sin tÃ­tulo');
    epTitle.title = episode.name || '';
    titleRow.appendChild(epTitle);
    info.appendChild(titleRow);
    info.appendChild(makeEl('p', 'episode-overview',
      episode.overview || 'Sin descripciÃ³n disponible.'));
    card.appendChild(info);

    const play = () => {
      dom.episodesContainer.querySelectorAll('.episode-card')
        .forEach((c) => c.classList.remove('active'));
      card.classList.add('active');

      startPlayback({
        type: 'tv',
        id: tvId,
        season: seasonNumber,
        episode: episode.episode_number,
        title: `${seriesTitle} Â· T${seasonNumber}:E${episode.episode_number}${episode.name ? ` â€” ${episode.name}` : ''}`
      });
    };

    card.addEventListener('click', play);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); }
    });
    card.addEventListener('focus', () => {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });

    fragment.appendChild(card);
  });

  dom.episodesContainer.appendChild(fragment);
}

/* ==========================================================================
 * 18. BUSCADOR
 * ========================================================================== */

/** Estado inicial del modal de bÃºsqueda. */
function renderSearchInitialState() {
  renderEmptyState(dom.searchResultsGrid, {
    icon: 'fa-solid fa-magnifying-glass',
    title: 'Encuentra tu prÃ³xima pelÃ­cula',
    text: 'Escribe el tÃ­tulo, una saga o el nombre de un actor para ver resultados al instante.'
  });

  if (dom.searchStatusText) {
    dom.searchStatusText.replaceChildren(
      makeIcon('fa-solid fa-compass'),
      document.createTextNode(' Ingresa un tÃ©rmino para comenzar a buscar')
    );
  }
  toggleHidden(dom.searchModalLoader, true);
  toggleHidden(dom.modalClearSearchBtn, true);
}

function openSearchModal() {
  closeSidebar();
  if (!dom.searchModal) return;

  toggleHidden(dom.searchModal, false);
  syncScrollLock();
  state.lastFocusedElement = dom.headerSearchBtn;

  if (!dom.modalSearchInput.value.trim()) {
    renderSearchInitialState();
  } else {
    toggleHidden(dom.modalClearSearchBtn, false);
  }

  // En TV y mÃ³vil esto ademÃ¡s despliega el teclado en pantalla.
  setTimeout(() => {
    dom.modalSearchInput?.focus();
    dom.modalSearchInput?.select();
  }, 80);
}

function closeSearchModal() {
  if (!dom.searchModal) return;
  toggleHidden(dom.searchModal, true);
  syncScrollLock();
  if (dom.headerSearchBtn) focusAndCenter(dom.headerSearchBtn);
}

/** BÃºsqueda en el catÃ¡logo.
 * @param {string} query
 */
async function performModalSearch(query) {
  const clean = (query || '').trim();
  if (!clean) {
    renderSearchInitialState();
    return;
  }

  const token = ++state.tokens.search;

  toggleHidden(dom.modalClearSearchBtn, false);
  toggleHidden(dom.searchModalLoader, false);
  if (dom.searchStatusText) {
    dom.searchStatusText.textContent = `Buscando â€œ${clean}â€â€¦`;
  }

  let results = [];

  try {
    if (CONFIG.getApiKey()) {
      const data = await searchMulti(clean, 1);
      results = (data.results || []).filter(
        (i) => (i.media_type === 'movie' || i.media_type === 'tv') && (i.title || i.name)
      );
    } else {
      results = DEMO_ITEMS.filter((item) =>
        item.title.toLowerCase().includes(clean.toLowerCase())
      );
    }
  } catch (error) {
    console.warn('[Peloflix] BÃºsqueda en modo demostraciÃ³n:', error);
    results = DEMO_ITEMS.filter((item) =>
      item.title.toLowerCase().includes(clean.toLowerCase())
    );
  }

  // Una respuesta mÃ¡s reciente ya se pintÃ³: se descarta esta.
  if (token !== state.tokens.search) return;

  toggleHidden(dom.searchModalLoader, true);

  if (dom.searchStatusText) {
    const label = results.length === 1 ? 'tÃ­tulo' : 'tÃ­tulos';
    dom.searchStatusText.textContent =
      `${results.length} ${label} para â€œ${clean}â€`;
  }

  if (results.length === 0) {
    renderEmptyState(dom.searchResultsGrid, {
      icon: 'fa-solid fa-film',
      title: 'Sin coincidencias',
      text: `No encontramos nada para â€œ${clean}â€. Prueba con otro tÃ­tulo o revisa la ortografÃ­a.`
    });
    return;
  }

  const fragment = document.createDocumentFragment();
  results.forEach((item) => {
    fragment.appendChild(createMediaCard(item, {
      onSelect: () => {
        const data = normalizeItem(item);
        closeSearchModal();
        state.lastFocusedElement = dom.headerSearchBtn;
        openMediaModal(data.id, data.mediaType);
      }
    }));
  });

  dom.searchResultsGrid.replaceChildren(fragment);
}

/* ==========================================================================
 * 21. MOTOR DE NAVEGACIÃ“N D-PAD
 * ========================================================================== */

/**
 * CuÃ¡ntas tarjetas comparten la misma fila visual.
 * DEBE consultarse sobre el contenedor real: contar sobre todo el documento
 * mezcla la grilla del catÃ¡logo con la del buscador y devuelve un nÃºmero
 * de columnas que no corresponde.
 * @param {ParentNode} container
 * @param {string} selector
 * @returns {number}
 */
function getColumnsIn(container, selector) {
  if (!container) return 1;
  const items = Array.from(container.querySelectorAll(selector));
  if (items.length < 2) return 1;

  const firstTop = items[0].getBoundingClientRect().top;
  let count = 0;
  for (const item of items) {
    if (Math.abs(item.getBoundingClientRect().top - firstTop) < 12) count++;
    else break;
  }
  return Math.max(1, count);
}

/**
 * Elementos enfocada actualmente dentro de un contenedor.
 * @param {ParentNode} container
 * @returns {HTMLElement[]}
 */
function getFocusables(container) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])')
  ).filter(isVisible);
}

/**
 * Tecla "Volver" de Smart TV (10009 en Tizen/WebOS) y Escape.
 * @param {KeyboardEvent} e
 * @returns {boolean} true si se gestionÃ³
 */
function handleBackKey(e) {
  // Dentro de un campo de texto, Backspace debe borrar.
  if (e.key === 'Backspace' && e.target.tagName === 'INPUT') return false;

  // De arriba (mÃ¡s superficial) hacia abajo: bÃºsqueda â†’ detalle/reproductor.
  if (dom.searchModal && !dom.searchModal.classList.contains('hidden')) {
    closeSearchModal();
    return true;
  }

  if (dom.mediaModal && !dom.mediaModal.classList.contains('hidden')) {
    if (isPlayerActive()) {
      stopAndClearPlayer();
      focusAndCenter(dom.modalPlayBtn);
    } else {
      closeMediaModal();
    }
    return true;
  }

  return false;
}

/**
 * NavegaciÃ³n espacial con el mando / teclado.
 * @param {KeyboardEvent} e
 */
function handleDpadNavigation(e) {
  const active = document.activeElement;

  const isDpadKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
  const isBackKey = e.key === 'Escape' || e.key === 'Backspace' ||
    e.keyCode === 10009 || e.keyCode === 461;

  // 1. Volver / Escape
  if (isBackKey) {
    if (handleBackKey(e)) e.preventDefault();
    return;
  }

  // 2. Con el reproductor activo cualquier tecla revive los controles.
  if (isPlayerActive()) {
    resetPlayerControlsTimer();

    if (!isDpadKey) return;
    e.preventDefault();

    // Solo controles realmente visibles (en IPTV el selector estÃ¡ oculto).
    const controls = getFocusables(dom.playerTopBar);
    const index = controls.indexOf(active);

    if (index === -1) {
      focusAndCenter(controls[0]);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      focusAndCenter(controls[index + 1] || controls[0]);
    } else {
      focusAndCenter(controls[index - 1] || controls[controls.length - 1]);
    }
    return;
  }

  if (!isDpadKey) return;

  // 3. Dentro de un modal: recorrido lineal de sus controles.
  const openModal = [dom.searchModal]
    .find((m) => m && !m.classList.contains('hidden'));

  if (openModal) {
    e.preventDefault();

    // Atajo: desde el input de bÃºsqueda, "abajo" entra a la primera tarjeta.
    if (active === dom.modalSearchInput && e.key === 'ArrowDown') {
      const firstCard = dom.searchResultsGrid?.querySelector('.media-card');
      focusAndCenter(firstCard || getFocusables(openModal)[0]);
      return;
    }

    const focusables = getFocusables(openModal);
    const index = focusables.indexOf(active);

    if (index === -1) {
      focusAndCenter(focusables[0]);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      focusAndCenter(focusables[index + 1] || focusables[0]);
    } else {
      focusAndCenter(focusables[index - 1] || focusables[focusables.length - 1]);
    }
    return;
  }

  // 4. Modal de detalle. Si el reproductor estÃ¡ activo ya se ha resuelto
  //    arriba, asÃ­ que aquÃ­ solo hay controles de ficha y episodios.
  if (dom.mediaModal && !dom.mediaModal.classList.contains('hidden')) {
    e.preventDefault();
    const focusables = getFocusables(dom.mediaModal);
    const index = focusables.indexOf(active);

    if (index === -1) {
      focusAndCenter(focusables[0]);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      focusAndCenter(focusables[index + 1] || focusables[0]);
    } else {
      focusAndCenter(focusables[index - 1] || focusables[focusables.length - 1]);
    }
    return;
  }

  // 6. Carruseles horizontales: izquierda/derecha dentro de la fila,
  //    arriba/abajo saltan de fila en fila.
  if (active && active.classList.contains('row-card')) {
    e.preventDefault();
    const row = active.closest('.row-scroll');
    if (!row) return;

    const cards = Array.from(row.querySelectorAll('.row-card'));
    const index = cards.indexOf(active);
    const rows = Array.from(dom.homeRowsContainer.querySelectorAll('.row-scroll'));
    const rowIndex = rows.indexOf(row);

    if (e.key === 'ArrowRight') {
      if (index + 1 < cards.length) focusAndCenter(cards[index + 1]);
    } else if (e.key === 'ArrowLeft') {
      if (index > 0) focusAndCenter(cards[index - 1]);
    } else if (e.key === 'ArrowDown') {
      const nextRow = rows[rowIndex + 1];
      if (nextRow) focusAndCenter(nextRow.querySelector('.row-card'));
      else if (dom.exploreAllBtn) focusAndCenter(dom.exploreAllBtn);
    } else if (rowIndex > 0) {
      focusAndCenter(rows[rowIndex - 1].querySelector('.row-card'));
    } else {
      focusAndCenter(dom.heroPlayBtn); // primera fila â†’ hero
    }
    return;
  }

  if (active === dom.exploreAllBtn) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = Array.from(dom.homeRowsContainer.querySelectorAll('.row-scroll'));
      focusAndCenter(rows[rows.length - 1]?.querySelector('.row-card'));
    }
    return;
  }

  // 7. Explorador de gÃ©neros (fila de botones + grilla).
  if (active && active.classList.contains('genre-filter-btn')) {
    e.preventDefault();
    const btns = Array.from(dom.genreBtnGrid.querySelectorAll('.genre-filter-btn'));
    const index = btns.indexOf(active);

    if (e.key === 'ArrowRight') {
      if (index + 1 < btns.length) focusAndCenter(btns[index + 1]);
    } else if (e.key === 'ArrowLeft') {
      if (index > 0) focusAndCenter(btns[index - 1]);
    } else if (e.key === 'ArrowDown') {
      focusAndCenter(dom.exploreGrid?.querySelector('.media-card') || dom.explorerBackBtn);
    } else if (dom.explorerBackBtn) {
      focusAndCenter(dom.explorerBackBtn);
    }
    return;
  }

  // 8. Grillas: navegaciÃ³n por columnas reales del contenedor.
  const gridContext = [
    { grid: dom.exploreGrid, item: '.media-card', up: dom.genreBtnGrid?.querySelector('.genre-filter-btn'), more: dom.exploreLoadMoreBtn },
    { grid: dom.mediaGrid, item: '.media-card, .live-channel-card', up: dom.heroPlayBtn, more: dom.loadMoreBtn }
  ].find((ctx) => ctx.grid && ctx.grid.contains(active));

  if (gridContext) {
    e.preventDefault();
    const cards = Array.from(gridContext.grid.querySelectorAll(gridContext.item));
    const index = cards.indexOf(active);
    const cols = getColumnsIn(gridContext.grid, gridContext.item);

    if (e.key === 'ArrowRight') {
      if (index + 1 < cards.length) focusAndCenter(cards[index + 1]);
    } else if (e.key === 'ArrowLeft') {
      if (index > 0) focusAndCenter(cards[index - 1]);
    } else if (e.key === 'ArrowDown') {
      if (index + cols < cards.length) focusAndCenter(cards[index + cols]);
      else if (gridContext.more && isVisible(gridContext.more)) focusAndCenter(gridContext.more);
    } else if (index - cols >= 0) {
      focusAndCenter(cards[index - cols]);
    } else if (gridContext.up) {
      focusAndCenter(gridContext.up);
    }
    return;
  }

  // 9. Barra de pestaÃ±as de categorÃ­a.
  const tabs = Array.from(dom.navTabButtons);
  const tabIndex = tabs.indexOf(active);

  if (tabIndex !== -1) {
    e.preventDefault();
    if (e.key === 'ArrowRight') focusAndCenter(tabs[tabIndex + 1] || tabs[0]);
    else if (e.key === 'ArrowLeft') focusAndCenter(tabs[tabIndex - 1] || tabs[tabs.length - 1]);
    else if (e.key === 'ArrowDown') focusAndCenter(dom.heroPlayBtn);
    else focusAndCenter(dom.brandLogo);
    return;
  }

  // 10. Cabecera: logo â†’ buscar â†’ ajustes.
  const headerChain = [dom.brandLogo, dom.headerSearchBtn, dom.headerSettingsBtn].filter(Boolean);
  const headerIndex = headerChain.indexOf(active);

  if (headerIndex !== -1) {
    e.preventDefault();

    if (e.key === 'ArrowLeft' && headerIndex > 0) {
      focusAndCenter(headerChain[headerIndex - 1]);
    } else if (e.key === 'ArrowRight' && headerIndex + 1 < headerChain.length) {
      focusAndCenter(headerChain[headerIndex + 1]);
    } else if (e.key === 'ArrowDown') {
      const activeTab = document.querySelector('.nav-tab-btn.active') || tabs[0];
      focusAndCenter(activeTab || dom.heroPlayBtn);
    }
    return;
  }

  // 11. Hero.
  if (active === dom.heroPlayBtn || active === dom.heroInfoBtn) {
    e.preventDefault();
    const isPlay = active === dom.heroPlayBtn;

    if (e.key === 'ArrowRight' && isPlay) focusAndCenter(dom.heroInfoBtn);
    else if (e.key === 'ArrowLeft' && !isPlay) focusAndCenter(dom.heroPlayBtn);
    else if (e.key === 'ArrowUp') {
      const activeTab = document.querySelector('.nav-tab-btn.active') || tabs[0];
      focusAndCenter(activeTab || dom.headerSearchBtn);
    } else if (e.key === 'ArrowDown') {
      const firstRowCard = document.querySelector('.row-scroll .row-card');
      const firstCard = dom.mediaGrid?.querySelector('.media-card');
      focusAndCenter(firstRowCard || firstCard || dom.exploreAllBtn);
    }
    return;
  }

  if (active === dom.loadMoreBtn || active === dom.exploreLoadMoreBtn) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const grid = active === dom.loadMoreBtn ? dom.mediaGrid : dom.exploreGrid;
      const cards = grid?.querySelectorAll('.media-card, .live-channel-card');
      if (cards?.length) focusAndCenter(cards[cards.length - 1]);
    }
  }
}

/* ==========================================================================
 * 22. EVENT LISTENERS
 * ========================================================================== */

/** Conecta un botÃ³n que se activa con Enter o Espacio. */
function onActivate(element, handler) {
  if (!element) return;
  element.addEventListener('click', handler);
  element.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler(e);
    }
  });
}

/** Cierra un modal al pulsar fuera de Ã©l. */
function closeOnBackdropClick(modal, close) {
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
}

/** LÃ³gica de auto-ocultado del header segÃºn direcciÃ³n del scroll. */
function setupHeaderScrollBehavior() {
  const COMPACT_THRESHOLD = 50;
  const HIDE_THRESHOLD = 120;
  const DELTA_THRESHOLD = 6;
  const TOP_SLACK = 15;

  let lastScrollY = Math.max(0, window.scrollY || 0);

  const update = () => {
    const scrollY = Math.max(0, window.scrollY || 0);
    const delta = scrollY - lastScrollY;

    if (scrollY <= TOP_SLACK) {
      dom.header?.classList.remove('header-scrolled', 'header-hidden');
      return;
    }

    const compact = scrollY > COMPACT_THRESHOLD;
    dom.header?.classList.toggle('header-scrolled', compact);

    if (compact) {
      dom.header?.classList.remove('header-hidden');
    } else {
      dom.header?.classList.remove('header-hidden');
    }

    lastScrollY = scrollY;
  };

  window.addEventListener('scroll', update, { passive: true });
  update();

  // Si algo dentro del header recibe foco, el header debe verse.
  dom.header?.addEventListener('focusin', () => {
    dom.header.classList.remove('header-hidden');
  });
}

function setupEventListeners() {
  /* --- NavegaciÃ³n global --- */
  window.addEventListener('keydown', handleDpadNavigation);

  /* --- Logo y pestaÃ±as --- */
  dom.brandLogo?.addEventListener('click', (e) => {
    e.preventDefault();
    loadActiveTab('movie', 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  dom.navTabButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      loadActiveTab(btn.dataset.category, 1);
    });
  });

  /* --- Buscador --- */
  // onActivate(dom.headerSearchBtn, openSearchModal);
  onActivate(dom.searchModalCloseBtn, closeSearchModal);
  closeOnBackdropClick(dom.searchModal, closeSearchModal);

  const debouncedSearch = debounce((value) => performModalSearch(value), 350);

  dom.modalSearchInput?.addEventListener('input', (e) => {
    const value = e.target.value;
    toggleHidden(dom.modalClearSearchBtn, value.length === 0);
    debouncedSearch(value);
  });

  dom.modalSearchInput?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    debouncedSearch.cancel(); // no esperar al debounce con Enter
    const firstCard = dom.searchResultsGrid?.querySelector('.media-card');
    if (firstCard) focusAndCenter(firstCard);
    else performModalSearch(dom.modalSearchInput.value);
  });

  onActivate(dom.modalClearSearchBtn, () => {
    dom.modalSearchInput.value = '';
    state.tokens.search++; // invalida la bÃºsqueda en vuelo
    renderSearchInitialState();
    dom.modalSearchInput.focus();
  });

  /* --- PaginaciÃ³n --- */
  onActivate(dom.loadMoreBtn, () => {
    if (state.currentPage < state.totalPages) {
      loadActiveTab(state.currentTab, state.currentPage + 1);
    }
  });

  /* --- Explorador --- */
  onActivate(dom.exploreAllBtn, showCategoryExplorer);
  onActivate(dom.explorerBackBtn, hideCategoryExplorer);

  onActivate(dom.exploreLoadMoreBtn, () => {
    const { activeGenreId, currentPage, totalPages } = state.explorer;
    if (!activeGenreId || currentPage >= totalPages) return;

    const activeBtn = dom.genreBtnGrid.querySelector('.genre-filter-btn.active');
    const label = activeBtn ? activeBtn.textContent.trim() : '';
    loadGenreResults(activeGenreId, label, currentPage + 1);
  });

  /* --- Modal de tÃ­tulo --- */
  onActivate(dom.modalCloseBtn, closeMediaModal);
  closeOnBackdropClick(dom.mediaModal, closeMediaModal);

  /* --- Reproductor --- */
  onActivate(dom.playerCloseViewBtn, () => {
    stopAndClearPlayer();
    focusAndCenter(dom.modalPlayBtn);
  });

  dom.serverBtnGroup?.addEventListener('click', (e) => {
    const btn = e.target.closest('.server-btn');
    if (btn?.dataset.server) handleServerChange(btn.dataset.server);
  });

  dom.serverBtnGroup?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const btn = e.target.closest('.server-btn');
    if (!btn?.dataset.server) return;
    e.preventDefault();
    handleServerChange(btn.dataset.server);
  });

  onActivate(dom.quickSwitchServerBtn, cycleNextServer);

  /* --- Hero --- */
  const openFromHero = (autoPlay) => {
    const item = state.featuredHeroItem;
    if (!item) return;

    state.lastFocusedElement = autoPlay ? dom.heroPlayBtn : dom.heroInfoBtn;

    if (item.isLiveChannel) {
      openLiveChannel(item);
      return;
    }
    const data = normalizeItem(item);
    if (data) openMediaModal(data.id, data.mediaType, autoPlay);
  };

  onActivate(dom.heroPlayBtn, () => openFromHero(true));
  onActivate(dom.heroInfoBtn, () => openFromHero(false));

  onActivate(dom.modalPlayBtn, () => {
    const details = state.activeItemDetails;
    if (!details) return;

    const title = dom.modalTitle.textContent;
    if (details.media_type === 'movie') {
      startPlayback({ type: 'movie', id: details.id, title });
    } else {
      const season = state.activeSeason || 1;
      startPlayback({
        type: 'tv', id: details.id, season, episode: 1,
        title: `${title} Â· T${season}:E1`
      });
    }
  });

  /* --- Comportamiento del header --- */
  setupHeaderScrollBehavior();

  /* --- Salida nativa de pantalla completa --- */
  const onFullscreenExit = () => {
    const stillFull = document.fullscreenElement || document.webkitFullscreenElement;
    if (stillFull || !isPlayerActive()) return;
    focusAndCenter(dom.serverBtnGroup?.querySelector('.server-btn.active') ||
      dom.playerCloseViewBtn);
  };
  document.addEventListener('fullscreenchange', onFullscreenExit);
  document.addEventListener('webkitfullscreenchange', onFullscreenExit);

  /* --- ReapariciÃ³n de los controles del reproductor --- */
  const wakeControls = () => {
    if (isPlayerActive()) resetPlayerControlsTimer();
  };
  window.addEventListener('mousemove', wakeControls, { passive: true });
  window.addEventListener('touchstart', wakeControls, { passive: true });
  dom.modalPlayerSection?.addEventListener('click', wakeControls);

  dom.playerTopBar?.addEventListener('focusin', () => {
    showPlayerControls();
    clearTimeout(playerControlsTimer);
  });
  dom.playerTopBar?.addEventListener('focusout', () => {
    if (isPlayerActive()) resetPlayerControlsTimer();
  });
}

/* ==========================================================================
 * 23. ARRANQUE
 * ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadActiveTab('movie', 1);

  // Foco inicial en la pestaÃ±a activa: en TV es el punto de partida del D-Pad.
  setTimeout(() => {
    const start = document.querySelector('.nav-tab-btn.active') || dom.heroPlayBtn;
    if (start) start.focus({ preventScroll: true });
  }, 350);
});

// Expuesto para depuraciÃ³n en consola.
window.Peloflix = { state, CONFIG, DEMO_ITEMS, LIVE_CHANNELS };

/* ==========================================================================
   PREMIUM ANIMATIONS (SCROLL REVEAL)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const rows = document.querySelectorAll('.content-row');
  
  // Agregar clase inicial para que estén ocultos
  rows.forEach(row => row.classList.add('fade-row'));

  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };

  const rowObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  rows.forEach(row => {
    rowObserver.observe(row);
  });
});

/* ==========================================================================
   NATIVE VIDEO PLAYER LOGIC
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const playerSection = document.getElementById('player-section');
  const heroPlayBtn = document.getElementById('hero-play-btn');
  const mainPlayer = document.getElementById('main-player');

  if (heroPlayBtn && playerSection) {
    heroPlayBtn.addEventListener('click', (e) => {
      e.preventDefault(); 
      playerSection.classList.remove('hidden');
      setTimeout(() => {
        playerSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (mainPlayer) {
          mainPlayer.play().catch(err => console.log('Autoplay prevented by browser:', err));
        }
      }, 100);
    });
  }
});

/* ==========================================================================
   ADVANCED SEARCH OVERLAY LOGIC
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const searchOverlay = document.getElementById('search-overlay');
  const searchInput = document.getElementById('search-overlay-input');
  const searchCloseBtn = document.getElementById('search-close-btn');
  const searchResults = document.getElementById('search-overlay-results');
  const headerSearchBtn = document.getElementById('header-search-btn');

  if (headerSearchBtn && searchOverlay) {
    headerSearchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      searchOverlay.classList.remove('hidden');
      setTimeout(() => searchInput.focus(), 100);
    });
  }

  if (searchCloseBtn) {
    searchCloseBtn.addEventListener('click', () => {
      searchOverlay.classList.add('hidden');
      searchInput.value = '';
      searchResults.innerHTML = '';
    });
  }

  if (searchInput && searchResults) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (!val) {
        searchResults.innerHTML = '';
        return;
      }
      // Generar tarjetas de prueba
      searchResults.innerHTML = `
        <div class="media-card">
          <div class="card-poster-wrap"><img src="https://image.tmdb.org/t/p/w500/8RpDcsfLJypbO6vtec8O51Wf6G0.jpg" class="card-poster" alt="Test"></div>
          <div class="card-info"><h3 class="card-title">Resultado 1: ${val}</h3></div>
        </div>
        <div class="media-card">
          <div class="card-poster-wrap"><img src="https://image.tmdb.org/t/p/w500/8RpDcsfLJypbO6vtec8O51Wf6G0.jpg" class="card-poster" alt="Test"></div>
          <div class="card-info"><h3 class="card-title">Resultado 2: ${val}</h3></div>
        </div>
      `;
    });
  }
});
