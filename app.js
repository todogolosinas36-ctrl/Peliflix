/**
 * ============================================================================
 * PelisFlix - Plataforma de Streaming Web
 * ============================================================================
 * Optimizada para Smart TV (Android TV, WebOS, Tizen) y Pantallas Táctiles Móviles.
 * - Navegación espacial D-Pad (Flechas Arriba/Abajo/Izquierda/Derecha, Enter, Volver).
 * - Auto-scroll centrado en el elemento activo para visión a 3 metros.
 * - Menú lateral sin dependencia exclusiva de hover (abre/cierra por botón, control remoto o touch).
 * - Reproductor multiservidor con corte de sonido inmediato en iframe.src.
 */

// ============================================================================
// 1. CONFIGURACIÓN Y API KEY
// ============================================================================

const API_KEY = 'TU_API_KEY_AQUI';
const ADMIN_PIN = 'Pia26';

const CONFIG = {
  getApiKey: () => {
    const localKey = localStorage.getItem('pelisflix_tmdb_api_key');
    if (localKey && localKey.trim() !== '') return localKey.trim();
    if (API_KEY && API_KEY !== 'TU_API_KEY_AQUI' && API_KEY.trim() !== '') return API_KEY.trim();
    return '';
  },
  BASE_URL: 'https://api.themoviedb.org/3',
  IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/w500',
  BACKDROP_BASE_URL: 'https://image.tmdb.org/t/p/original',
  LANGUAGE: 'es-MX',

  // Servidores de Embed optimizados para Audio Latino y Subtítulos en Español
  SERVERS: {
    vidsrc: {
      name: 'Servidor 1 (VidSrc) - Rápido HD',
      badge: 'VidSrc HD',
      getMovieUrl: (id) => `https://vidsrc.to/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`
    },
    embed_su: {
      name: 'Servidor 2 (Embed.su) - Multi-Audio & Sub',
      badge: 'Multi-Audio / Sub',
      getMovieUrl: (id) => `https://embed.su/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`
    },
    vidsrc_pro: {
      name: 'Servidor 3 (VidSrc PRO) - Calidad 1080p',
      badge: 'VidSrc PRO',
      getMovieUrl: (id) => `https://vidsrc.pro/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://vidsrc.pro/embed/tv/${id}/${s}/${e}`
    },
    vidsrc_vip: {
      name: 'Servidor 4 (VidSrc VIP) - Alta Estabilidad',
      badge: 'VidSrc VIP',
      getMovieUrl: (id) => `https://vidsrc.vip/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://vidsrc.vip/embed/tv/${id}/${s}/${e}`
    },
    autoembed: {
      name: 'Servidor 5 (AutoEmbed) - Audio Latino & Sub',
      badge: 'Latino & Sub',
      getMovieUrl: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`
    },
    multiembed: {
      name: 'Servidor 6 (MultiEmbed) - Español & Multi-idioma',
      badge: 'Multi-idioma / ES',
      getMovieUrl: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
      getTvUrl: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`
    }
  },

  FALLBACK_POSTER: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect fill="%231a1a1a" width="300" height="450"/><text fill="%23777" font-family="sans-serif" font-size="20" dy="10.5" font-weight="bold" x="50%" y="50%" text-anchor="middle">PelisFlix</text></svg>'
};

// ============================================================================
// 2. ESTADO GLOBAL DE LA APLICACIÓN
// ============================================================================
const state = {
  currentTab: 'movie',
  currentPage: 1,
  totalPages: 1,
  searchQuery: '',
  mediaItems: [],
  featuredHeroItem: null,
  activeItemDetails: null,
  lastFocusedElementBeforeModal: null,

  currentPlayback: {
    type: null,
    id: null,
    season: 1,
    episode: 1,
    title: ''
  },
  selectedServer: 'vidsrc',
  activeSeason: 1,

  // Estado del Explorador de Categorías
  explorer: {
    activeGenreId: null,
    currentPage: 1,
    totalPages: 1
  }
};

// ============================================================================
// 2.B CONFIGURACIÓN DE FILAS NETFLIX Y GÉNEROS TMDB
// ============================================================================

const HOME_ROWS = [
  { id: 'estrenos', scrollId: 'row-scroll-estrenos', title: 'Películas Estrenos 2026', endpoint: '/discover/movie', params: { primary_release_year: 2026, sort_by: 'popularity.desc' } },
  { id: 'accion', scrollId: 'row-scroll-accion', title: 'Acción Sin Límites', endpoint: '/discover/movie', params: { with_genres: 28, sort_by: 'popularity.desc' } },
  { id: 'comedia', scrollId: 'row-scroll-comedia', title: 'Comedia para Reír', endpoint: '/discover/movie', params: { with_genres: 35, sort_by: 'popularity.desc' } },
  { id: 'terror', scrollId: 'row-scroll-terror', title: 'Terror y Suspenso', endpoint: '/discover/movie', params: { with_genres: 27, sort_by: 'popularity.desc' } }
];

const TMDB_GENRES = [
  { id: 28, name: 'Acción', icon: 'fa-solid fa-explosion' },
  { id: 12, name: 'Aventura', icon: 'fa-solid fa-mountain-sun' },
  { id: 16, name: 'Animación', icon: 'fa-solid fa-wand-magic-sparkles' },
  { id: 35, name: 'Comedia', icon: 'fa-solid fa-face-laugh-squint' },
  { id: 80, name: 'Crimen', icon: 'fa-solid fa-user-secret' },
  { id: 99, name: 'Documental', icon: 'fa-solid fa-clapperboard' },
  { id: 18, name: 'Drama', icon: 'fa-solid fa-masks-theater' },
  { id: 10751, name: 'Familia', icon: 'fa-solid fa-people-roof' },
  { id: 14, name: 'Fantasía', icon: 'fa-solid fa-hat-wizard' },
  { id: 36, name: 'Historia', icon: 'fa-solid fa-landmark' },
  { id: 27, name: 'Terror', icon: 'fa-solid fa-ghost' },
  { id: 10402, name: 'Música', icon: 'fa-solid fa-music' },
  { id: 9648, name: 'Misterio', icon: 'fa-solid fa-magnifying-glass' },
  { id: 10749, name: 'Romance', icon: 'fa-solid fa-heart' },
  { id: 878, name: 'Ciencia Ficción', icon: 'fa-solid fa-rocket' },
  { id: 53, name: 'Suspense', icon: 'fa-solid fa-bolt' },
  { id: 10752, name: 'Guerra', icon: 'fa-solid fa-shield-halved' },
  { id: 37, name: 'Western', icon: 'fa-solid fa-hat-cowboy' }
];

// ============================================================================
// 3. REFERENCIAS AL DOM
// ============================================================================
const dom = {
  header: document.getElementById('main-header'),
  brandLogo: document.getElementById('brand-logo'),
  headerSearchBtn: document.getElementById('header-search-btn'),
  sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
  sidebarOverlay: document.getElementById('sidebar-overlay'),

  // Barra de Pestañas Sub-Navbar
  subNavbar: document.getElementById('sub-navbar'),
  navTabButtons: document.querySelectorAll('.nav-tab-btn'),

  // Panel Lateral Derecho
  rightSidebar: document.getElementById('right-sidebar'),
  sidebarEdgeTab: document.getElementById('sidebar-edge-tab'),
  sidebarCloseBtn: document.getElementById('sidebar-close-btn'),
  sidebarNavButtons: document.querySelectorAll('.sidebar-nav-btn'),
  sidebarSearchBtn: document.getElementById('sidebar-search-btn'),

  // Modal Dedicado de Búsqueda
  searchModal: document.getElementById('search-modal'),
  searchModalCloseBtn: document.getElementById('search-modal-close-btn'),
  modalSearchInput: document.getElementById('modal-search-input'),
  modalClearSearchBtn: document.getElementById('modal-clear-search-btn'),
  searchResultsGrid: document.getElementById('search-results-grid'),
  searchStatusText: document.getElementById('search-status-text'),
  searchModalLoader: document.getElementById('search-modal-loader'),

  // Configuración y Autenticación PIN
  configMenuBtn: document.getElementById('config-menu-btn'),
  pinModal: document.getElementById('pin-modal'),
  pinCloseBtn: document.getElementById('pin-close-btn'),
  pinForm: document.getElementById('pin-form'),
  pinInput: document.getElementById('pin-input'),
  pinError: document.getElementById('pin-error'),
  pinSubmitBtn: document.getElementById('pin-submit-btn'),
  pinCancelBtn: document.getElementById('pin-cancel-btn'),
  settingsModal: document.getElementById('settings-modal'),
  settingsCloseBtn: document.getElementById('settings-close-btn'),

  // Módulo de API Key
  apiStatusBadge: document.getElementById('api-status-badge'),
  apiKeyInput: document.getElementById('api-key-input'),
  saveApiKeyBtn: document.getElementById('save-api-key-btn'),
  clearApiKeyBtn: document.getElementById('clear-api-key-btn'),

  // Hero Banner
  heroBanner: document.getElementById('hero-banner'),
  heroBackdrop: document.getElementById('hero-backdrop'),
  heroBadge: document.getElementById('hero-badge'),
  heroTitle: document.getElementById('hero-title'),
  heroMeta: document.getElementById('hero-meta'),
  heroOverview: document.getElementById('hero-overview'),
  heroPlayBtn: document.getElementById('hero-play-btn'),
  heroInfoBtn: document.getElementById('hero-info-btn'),

  // Catálogo y Grilla
  catalogSection: document.getElementById('catalog-section'),
  sectionTitle: document.getElementById('section-title'),
  sectionSubtitle: document.getElementById('section-subtitle'),
  resultsCount: document.getElementById('results-count'),
  mediaGrid: document.getElementById('media-grid'),
  loader: document.getElementById('loader'),
  loadMoreBtn: document.getElementById('load-more-btn'),

  // Layout Netflix: Filas Horizontales
  homeRowsContainer: document.getElementById('home-rows-container'),
  rowScrollEstrenos: document.getElementById('row-scroll-estrenos'),
  rowScrollAccion: document.getElementById('row-scroll-accion'),
  rowScrollComedia: document.getElementById('row-scroll-comedia'),
  rowScrollTerror: document.getElementById('row-scroll-terror'),
  exploreAllBtn: document.getElementById('explore-all-btn'),

  // Explorador de Categorías
  categoryExplorer: document.getElementById('category-explorer'),
  explorerBackBtn: document.getElementById('explorer-back-btn'),
  genreBtnGrid: document.getElementById('genre-btn-grid'),
  explorerResultsTitle: document.getElementById('explorer-results-title'),
  explorerLoader: document.getElementById('explorer-loader'),
  exploreGrid: document.getElementById('explore-grid'),
  exploreLoadMoreBtn: document.getElementById('explore-load-more-btn'),

  // Modal Flotante
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

  // Reproductor Multiservidor
  modalPlayerSection: document.getElementById('modal-player-section'),
  playerTopBar: document.getElementById('player-top-bar') || document.querySelector('.player-top-bar'),
  playerPlayingTitle: document.getElementById('player-playing-title'),
  serverSelect: document.getElementById('server-select'),
  quickSwitchServerBtn: document.getElementById('quick-switch-server-btn'),
  serverActiveBadge: document.getElementById('server-active-badge'),
  serverBadgeText: document.getElementById('server-badge-text'),
  playerCloseViewBtn: document.getElementById('player-close-view-btn'),
  videoPlayerIframe: document.getElementById('video-player'),
  liveTvPlayer: document.getElementById('liveTvPlayer'),

  // Series de TV
  modalTvEpisodes: document.getElementById('modal-tv-episodes'),
  seasonSelect: document.getElementById('season-select'),
  episodesLoader: document.getElementById('episodes-loader'),
  episodesContainer: document.getElementById('episodes-container'),

  // Toast
  toast: document.getElementById('toast')
};

// Instancia global de Hls.js para reproducción IPTV
let hlsInstance = null;

// ============================================================================
// 4. DATOS DE DEMOSTRACIÓN (FALLBACK INMEDIATO)
// ============================================================================
const DEMO_ITEMS = [
  // Películas
  {
    id: 157336,
    title: 'Interstellar',
    media_type: 'movie',
    category: 'movie',
    overview: 'Un grupo de científicos y exploradores viajan a través de un agujero de gusano para encontrar un nuevo hogar para la humanidad.',
    poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdrop_path: '/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
    vote_average: 8.4,
    release_date: '2014-11-05'
  },
  {
    id: 693134,
    title: 'Dune: Parte Dos',
    media_type: 'movie',
    category: 'movie',
    overview: 'Paul Atreides se une a Chani y a los Fremen mientras busca venganza contra los conspiradores que destruyeron a su familia.',
    poster_path: '/8b8R8l88Qje9dn9OE8PY05Nx1S8.jpg',
    backdrop_path: '/xOMo8BRK7PfcJv9JCnx7s520048.jpg',
    vote_average: 8.2,
    release_date: '2024-02-27'
  },
  {
    id: 155,
    title: 'The Dark Knight',
    media_type: 'movie',
    category: 'movie',
    overview: 'Batman debe aceptar uno de los mayores desafíos de su capacidad para luchar contra el Joker, un criminal despiadado que siembra el caos.',
    poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    backdrop_path: '/dqK9Hag1054tghRQSqLSfrkvQnA.jpg',
    vote_average: 8.5,
    release_date: '2008-07-16'
  },
  {
    id: 872585,
    title: 'Oppenheimer',
    media_type: 'movie',
    category: 'movie',
    overview: 'La historia del físico J. Robert Oppenheimer y su liderazgo en el Proyecto Manhattan que cambió la historia del mundo para siempre.',
    poster_path: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    backdrop_path: '/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg',
    vote_average: 8.1,
    release_date: '2023-07-19'
  },

  // Series
  {
    id: 66732,
    name: 'Stranger Things',
    title: 'Stranger Things',
    media_type: 'tv',
    category: 'tv',
    overview: 'Tras la misteriosa desaparición de un niño, un pequeño pueblo descubre un secreto con experimentos clasificados y fuerzas sobrenaturales.',
    poster_path: '/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
    backdrop_path: '/56v2KjBlU4XaOv9rVYEQypROD7P.jpg',
    vote_average: 8.6,
    first_air_date: '2016-07-15',
    number_of_seasons: 4
  },
  {
    id: 1399,
    name: 'Game of Thrones',
    title: 'Juego de Tronos',
    media_type: 'tv',
    category: 'tv',
    overview: 'Siete familias nobles luchan por el control de la mítica tierra de Poniente en una violenta batalla por el Trono de Hierro.',
    poster_path: '/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg',
    backdrop_path: '/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg',
    vote_average: 8.4,
    first_air_date: '2011-04-17',
    number_of_seasons: 8
  },
  {
    id: 1396,
    name: 'Breaking Bad',
    title: 'Breaking Bad',
    media_type: 'tv',
    category: 'tv',
    overview: 'Un profesor de química de secundaria con cáncer terminal recurre a la fabricación de metanfetamina para asegurar el futuro de su familia.',
    poster_path: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    backdrop_path: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
    vote_average: 8.9,
    first_air_date: '2008-01-20',
    number_of_seasons: 5
  },

  // Anime
  {
    id: 1429,
    name: 'Attack on Titan',
    title: 'Ataque a los Titanes (Shingeki no Kyojin)',
    media_type: 'tv',
    category: 'anime',
    overview: 'La humanidad vive dentro de ciudades rodeadas por enormes muros que los protegen de los Titanes. Eren Jaeger jura erradicarlos tras la caída de su hogar.',
    poster_path: '/aiy35EvapPV79Q87zyiyYKdwAI.jpg',
    backdrop_path: '/y74tlGv7z4EFTj8i2Zq60jIqjP.jpg',
    vote_average: 8.9,
    first_air_date: '2013-04-07',
    number_of_seasons: 4
  },
  {
    id: 85937,
    name: 'Demon Slayer: Kimetsu no Yaiba',
    title: 'Demon Slayer (Kimetsu no Yaiba)',
    media_type: 'tv',
    category: 'anime',
    overview: 'Tanjiro Kamado emprende un viaje para vengar a su familia asesinada y buscar una cura para su hermana Nezuko, convertida en demonio.',
    poster_path: '/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg',
    backdrop_path: '/nTvM4mhqZlHIvUkI1gVnWumQU84.jpg',
    vote_average: 8.7,
    first_air_date: '2019-04-06',
    number_of_seasons: 4
  },
  {
    id: 12971,
    name: 'Dragon Ball Z',
    title: 'Dragon Ball Z',
    media_type: 'tv',
    category: 'anime',
    overview: 'Goku y los Guerreros Z defienden la Tierra de poderosos villanos galácticos como los Saiyajins, Freezer, Cell y Majin Buu.',
    poster_path: '/dBsjo54k9zF4AocHwL7Hj03bJ3n.jpg',
    backdrop_path: '/f53JvlEgqvVoq7Tz6p6u8Y0NdrM.jpg',
    vote_average: 8.3,
    first_air_date: '1989-04-26',
    number_of_seasons: 9
  },

  // Dibujos Animados
  {
    id: 60625,
    name: 'Rick and Morty',
    title: 'Rick y Morty',
    media_type: 'tv',
    category: 'cartoons',
    overview: 'Un científico brillante pero alcohólico y su temeroso nieto viajan por dimensiones infinitas enfrentando aventuras cósmicas.',
    poster_path: '/cvhNj9eoRBe5SxjardzrVZNTISn.jpg',
    backdrop_path: '/uK9uV0j2J8eK7s6W6t8M9Qe9z6M.jpg',
    vote_average: 8.7,
    first_air_date: '2013-12-02',
    number_of_seasons: 7
  },
  {
    id: 94605,
    name: 'Arcane',
    title: 'Arcane',
    media_type: 'tv',
    category: 'cartoons',
    overview: 'En medio del conflicto entre las ciudades gemelas de Piltóver y Zaun, dos hermanas luchan en bandos opuestos de una guerra tecnológica.',
    poster_path: '/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg',
    backdrop_path: '/v4y1m1scvK4x2K0tqL68Xm8Pj6J.jpg',
    vote_average: 8.7,
    first_air_date: '2021-11-06',
    number_of_seasons: 2
  },
  {
    id: 456,
    name: 'The Simpsons',
    title: 'Los Simpson',
    media_type: 'tv',
    category: 'cartoons',
    overview: 'Las sátiras y aventuras de la emblemática familia Simpson y los habitantes de la ciudad de Springfield.',
    poster_path: '/k55w9T3m72qV3xG3f2y6f4g.jpg',
    backdrop_path: '/hpU2cHC9tk90hG7neKaCVNm7DY.jpg',
    vote_average: 8.0,
    first_air_date: '1989-12-17',
    number_of_seasons: 35
  }
];

// ============================================================================
// 4.B BASE DE DATOS LOCAL DE CANALES DE TV EN VIVO (IPTV)
// ============================================================================
const liveChannels = [
  { 
    id: 'tv1', 
    name: 'Telefe', 
    category: 'Nacional', 
    logo: 'https://i.imgur.com/logo_telefe.png', 
    stream_url: 'URL_M3U8_AQUI' 
  },
  { 
    id: 'tv2', 
    name: 'TV Pública', 
    category: 'Nacional', 
    logo: 'https://i.imgur.com/logo_tvp.png', 
    stream_url: 'URL_M3U8_AQUI' 
  },
  { 
    id: 'tv3', 
    name: 'Canal 10 Tucumán', 
    category: 'Regional', 
    logo: 'https://i.imgur.com/logo_c10.png', 
    stream_url: 'URL_M3U8_AQUI' 
  }
];

// Alias para compatibilidad con módulos internos
const LIVE_CHANNELS = liveChannels;

// ============================================================================
// 5. CONSUMO DE API TMDB
// ============================================================================

async function fetchFromTMDb(endpoint, params = {}) {
  const currentKey = CONFIG.getApiKey();
  if (!currentKey) throw new Error('NO_API_KEY');

  const queryParams = new URLSearchParams({
    api_key: currentKey,
    language: CONFIG.LANGUAGE,
    ...params
  });

  const url = `${CONFIG.BASE_URL}${endpoint}?${queryParams.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 401) throw new Error('INVALID_API_KEY');
      throw new Error(`HTTP Error ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`[TMDb] Error en petición a ${endpoint}:`, error.message);
    throw error;
  }
}

async function getTrending(page = 1) {
  return await fetchFromTMDb('/trending/all/week', { page });
}

async function getMovies(page = 1) {
  return await fetchFromTMDb('/discover/movie', {
    sort_by: 'popularity.desc',
    page
  });
}

async function getSeries(page = 1) {
  return await fetchFromTMDb('/discover/tv', {
    sort_by: 'popularity.desc',
    page
  });
}

async function getAnime(page = 1) {
  return await fetchFromTMDb('/discover/tv', {
    with_original_language: 'ja',
    with_genres: '16',
    sort_by: 'popularity.desc',
    page
  });
}

async function getCartoons(page = 1) {
  return await fetchFromTMDb('/discover/tv', {
    with_genres: '16',
    without_original_languages: 'ja',
    sort_by: 'popularity.desc',
    page
  });
}

async function searchMulti(query, page = 1) {
  return await fetchFromTMDb('/search/multi', {
    query: encodeURIComponent(query),
    page,
    include_adult: false
  });
}

async function getMediaDetails(mediaType, id) {
  return await fetchFromTMDb(`/${mediaType}/${id}`, {
    append_to_response: 'credits,videos'
  });
}

async function getSeasonEpisodes(tvId, seasonNumber) {
  return await fetchFromTMDb(`/tv/${tvId}/season/${seasonNumber}`);
}

// ============================================================================
// 6. UTILIDADES Y SISTEMA DE AUTO-SCROLL CONCENTRADO EN EL FOCO (SMART TV)
// ============================================================================

/**
 * Enfoca un elemento y lo centra automáticamente en la pantalla de la TV
 */
function focusAndCenter(element) {
  if (!element) return;
  element.focus();
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  });
}

function debounce(func, delay = 400) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

function formatYear(dateStr) {
  if (!dateStr) return 'N/D';
  return dateStr.substring(0, 4);
}

function showToast(message, duration = 3000) {
  dom.toast.textContent = message;
  dom.toast.classList.remove('hidden');
  setTimeout(() => {
    dom.toast.classList.add('hidden');
  }, duration);
}

function updateApiKeyStatus() {
  const currentKey = CONFIG.getApiKey();
  if (currentKey) {
    dom.apiStatusBadge.textContent = 'Key Activa';
    dom.apiStatusBadge.className = 'api-status-badge badge-active';
    dom.apiKeyInput.value = currentKey;
  } else {
    dom.apiStatusBadge.textContent = 'Modo Demo';
    dom.apiStatusBadge.className = 'api-status-badge badge-demo';
    dom.apiKeyInput.value = '';
  }
}

// ============================================================================
// 7. RENDERIZADO VISUAL
// ============================================================================

function renderHero(item) {
  if (!item) return;
  state.featuredHeroItem = item;

  const isMovie = item.media_type === 'movie' || (!item.media_type && item.title);
  const mediaType = isMovie ? 'movie' : 'tv';
  const title = item.title || item.name || 'Título Destacado';
  const year = formatYear(item.release_date || item.first_air_date);
  const rating = item.vote_average ? item.vote_average.toFixed(1) : '7.8';
  const overview = item.overview || 'Disfruta de esta aclamada producción en alta definición en PelisFlix.';

  const backdropUrl = item.backdrop_path 
    ? `${CONFIG.BACKDROP_BASE_URL}${item.backdrop_path}` 
    : (item.poster_path ? `${CONFIG.IMAGE_BASE_URL}${item.poster_path}` : '');

  if (backdropUrl) {
    dom.heroBackdrop.style.backgroundImage = `url("${backdropUrl}")`;
  }

  dom.heroBadge.innerHTML = `<i class="fa-solid fa-fire"></i> Destacado en ${isMovie ? 'Películas' : 'Series'}`;
  dom.heroTitle.textContent = title;
  dom.heroMeta.innerHTML = `
    <span class="hero-rating"><i class="fa-solid fa-star"></i> ${rating}</span>
    <span class="hero-year">${year}</span>
    <span class="hero-type-badge">${isMovie ? 'Película' : 'Serie'}</span>
  `;
  dom.heroOverview.textContent = overview;
}

function createMediaCard(item) {
  const isMovie = item.media_type === 'movie' || (!item.media_type && item.title && !item.name);
  const mediaType = isMovie ? 'movie' : 'tv';
  const title = item.title || item.name || 'Sin Título';
  const year = formatYear(item.release_date || item.first_air_date);
  const rating = item.vote_average ? item.vote_average.toFixed(1) : 'S/R';
  const posterSrc = item.poster_path ? `${CONFIG.IMAGE_BASE_URL}${item.poster_path}` : CONFIG.FALLBACK_POSTER;

  const card = document.createElement('article');
  card.className = 'media-card';
  card.setAttribute('tabindex', '0'); // Habilitado para D-Pad y teclado
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${title}, ${year}, calificación ${rating}`);

  card.innerHTML = `
    <div class="card-poster-wrapper">
      <img src="${posterSrc}" alt="Poster de ${title}" class="card-poster" loading="lazy" />
      <span class="card-badge-rating"><i class="fa-solid fa-star"></i> ${rating}</span>
      <span class="card-badge-type">${isMovie ? 'Película' : 'Serie'}</span>
      <div class="card-hover-overlay">
        <div class="card-play-icon">
          <i class="fa-solid fa-play"></i>
        </div>
      </div>
    </div>
    <div class="card-info">
      <h3 class="card-title" title="${title}">${title}</h3>
      <div class="card-meta">
        <span>${year}</span>
        <span>${isMovie ? 'Film' : 'TV'}</span>
      </div>
    </div>
  `;

  // Clic o Touch
  card.addEventListener('click', () => {
    state.lastFocusedElementBeforeModal = card;
    openMediaModal(item.id, mediaType);
  });

  // Tecla Enter
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      state.lastFocusedElementBeforeModal = card;
      openMediaModal(item.id, mediaType);
    }
  });

  // Auto-scroll al recibir foco mediante D-Pad
  card.addEventListener('focus', () => {
    card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  });

  return card;
}

function createSearchMediaCard(item) {
  const isMovie = item.media_type === 'movie' || (!item.media_type && item.title && !item.name);
  const mediaType = isMovie ? 'movie' : 'tv';
  const title = item.title || item.name || 'Sin Título';
  const year = formatYear(item.release_date || item.first_air_date);
  const rating = item.vote_average ? item.vote_average.toFixed(1) : 'S/R';
  const posterSrc = item.poster_path ? `${CONFIG.IMAGE_BASE_URL}${item.poster_path}` : CONFIG.FALLBACK_POSTER;

  const card = document.createElement('article');
  card.className = 'media-card';
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${title}, ${year}, calificación ${rating}`);

  card.innerHTML = `
    <div class="card-poster-wrapper">
      <img src="${posterSrc}" alt="Poster de ${title}" class="card-poster" loading="lazy" />
      <span class="card-badge-rating"><i class="fa-solid fa-star"></i> ${rating}</span>
      <span class="card-badge-type">${isMovie ? 'Película' : 'Serie'}</span>
      <div class="card-hover-overlay">
        <div class="card-play-icon">
          <i class="fa-solid fa-play"></i>
        </div>
      </div>
    </div>
    <div class="card-info">
      <h3 class="card-title" title="${title}">${title}</h3>
      <div class="card-meta">
        <span>${year}</span>
        <span>${isMovie ? 'Film' : 'TV'}</span>
      </div>
    </div>
  `;

  const onSelect = () => {
    closeSearchModal();
    state.lastFocusedElementBeforeModal = dom.headerSearchBtn;
    openMediaModal(item.id, mediaType);
  };

  card.addEventListener('click', onSelect);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSelect();
    }
  });

  card.addEventListener('focus', () => {
    card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  });

  return card;
}

/* Renderizado de Tarjeta para Canal de TV en Vivo (IPTV) */
function createLiveChannelCard(channel, index = 0) {
  const card = document.createElement('article');
  card.className = 'live-channel-card';
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  const chNum = channel.number || (index + 1);
  const chCategory = channel.category || 'Nacional';
  const chDesc = channel.description || channel.desc || 'Transmisión oficial de televisión en directo sin cortes.';
  card.setAttribute('aria-label', `${channel.name}, Canal ${chNum}, ${chCategory}`);

  const fallbackLogoSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect fill="%23222" width="200" height="100" rx="8"/><text fill="%23E50914" font-family="sans-serif" font-size="16" font-weight="bold" x="50%" y="50%" text-anchor="middle" dy="5.5">${channel.name}</text></svg>`;

  card.innerHTML = `
    <div class="channel-card-top">
      <span class="channel-number">CH ${chNum}</span>
      <span class="channel-live-badge"><i class="fa-solid fa-circle"></i> EN VIVO</span>
    </div>
    <div class="channel-logo-container">
      <img 
        src="${channel.logo}" 
        alt="Logo de ${channel.name}" 
        class="channel-logo" 
        loading="lazy"
        onerror="this.onerror=null; this.src='${fallbackLogoSvg}';"
      />
    </div>
    <div class="channel-card-body">
      <div class="channel-header-row">
        <h3 class="channel-name" title="${channel.name}">${channel.name}</h3>
        <span class="channel-category-tag">${chCategory}</span>
      </div>
      <p class="channel-desc">${chDesc}</p>
      <div class="channel-play-action">
        <i class="fa-solid fa-play"></i> Sintonizar
      </div>
    </div>
  `;

  // Clic o Toque
  card.addEventListener('click', () => {
    state.lastFocusedElementBeforeModal = card;
    openLiveChannel(channel);
  });

  // Tecla Enter para Control Remoto de Smart TV
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      state.lastFocusedElementBeforeModal = card;
      openLiveChannel(channel);
    }
  });

  // Auto-scroll al recibir foco
  card.addEventListener('focus', () => {
    card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  });

  return card;
}

/* Renderizado de Grilla de Canales en Vivo */
function renderLiveChannels(channels) {
  dom.mediaGrid.classList.add('live-grid');
  dom.mediaGrid.innerHTML = '';

  if (channels.length > 0) {
    const featured = channels[0];
    const chNum = featured.number || 1;
    const chCategory = featured.category || 'Nacional';
    const chDesc = featured.description || featured.desc || 'Transmisión en directo sin cortes.';
    dom.heroBackdrop.style.backgroundImage = `radial-gradient(circle, rgba(40,10,15,0.8) 0%, rgba(18,18,18,0.98) 100%)`;
    dom.heroBadge.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> Transmisión en Directo (IPTV)`;
    dom.heroTitle.textContent = `${featured.name} En Vivo`;
    dom.heroMeta.innerHTML = `
      <span class="hero-rating"><i class="fa-solid fa-signal"></i> Señal HD</span>
      <span class="hero-year">Canal ${chNum}</span>
      <span class="hero-type-badge">${chCategory}</span>
    `;
    dom.heroOverview.textContent = chDesc;
    state.featuredHeroItem = {
      ...featured,
      isLiveChannel: true
    };
  }

  const fragment = document.createDocumentFragment();
  channels.forEach((ch, idx) => {
    fragment.appendChild(createLiveChannelCard(ch, idx));
  });
  dom.mediaGrid.appendChild(fragment);

  if (dom.loadMoreBtn) {
    dom.loadMoreBtn.classList.add('hidden');
  }
}

function renderMediaGrid(items, append = false) {
  dom.mediaGrid.classList.remove('live-grid');
  if (!append) {
    dom.mediaGrid.innerHTML = '';
  }

  if (!items || items.length === 0) {
    if (!append) {
      dom.mediaGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <i class="fa-solid fa-film" style="font-size: 3.5rem; margin-bottom: 16px; opacity: 0.4;"></i>
          <h3>No se encontraron resultados</h3>
          <p>Presiona el botón de Menú para buscar otros títulos o cambiar de categoría.</p>
        </div>
      `;
    }
    dom.loadMoreBtn.classList.add('hidden');
    return;
  }

  const validItems = items.filter(item => item.media_type !== 'person' && (item.title || item.name));
  const fragment = document.createDocumentFragment();
  validItems.forEach(item => fragment.appendChild(createMediaCard(item)));
  dom.mediaGrid.appendChild(fragment);

  if (state.currentPage < state.totalPages && state.currentTab !== 'search') {
    dom.loadMoreBtn.classList.remove('hidden');
  } else {
    dom.loadMoreBtn.classList.add('hidden');
  }
}

function showSkeletons(count = 10) {
  dom.mediaGrid.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const sk = document.createElement('div');
    sk.className = 'card-skeleton';
    dom.mediaGrid.appendChild(sk);
  }
}

// ============================================================================
// 7.B LAYOUT NETFLIX: CARRUSELES HORIZONTALES Y EXPLORADOR DE CATEGORÍAS
// ============================================================================

/**
 * Crea una tarjeta compacta para las filas horizontales (Row Card)
 */
function createRowCard(item) {
  const isMovie = item.media_type === 'movie' || (!item.media_type && item.title && !item.name);
  const mediaType = isMovie ? 'movie' : 'tv';
  const title = item.title || item.name || 'Sin Título';
  const year = formatYear(item.release_date || item.first_air_date);
  const rating = item.vote_average ? item.vote_average.toFixed(1) : 'S/R';
  const posterSrc = item.poster_path ? `${CONFIG.IMAGE_BASE_URL}${item.poster_path}` : CONFIG.FALLBACK_POSTER;

  const card = document.createElement('article');
  card.className = 'row-card';
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${title}, ${year}, calificación ${rating}`);

  card.innerHTML = `
    <div class="row-card-poster-wrap">
      <img src="${posterSrc}" alt="Poster de ${title}" class="row-card-poster" loading="lazy" />
      <span class="row-card-rating"><i class="fa-solid fa-star"></i> ${rating}</span>
      <div class="row-card-overlay">
        <div class="row-card-play">
          <i class="fa-solid fa-play"></i>
        </div>
      </div>
    </div>
    <div class="row-card-info">
      <h3 class="row-card-title" title="${title}">${title}</h3>
      <div class="row-card-meta">
        <span>${year}</span>
        <span>${isMovie ? 'Film' : 'TV'}</span>
      </div>
    </div>
  `;

  // Clic o Touch para abrir modal
  card.addEventListener('click', () => {
    state.lastFocusedElementBeforeModal = card;
    openMediaModal(item.id, mediaType);
  });

  // Enter para Smart TV
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      state.lastFocusedElementBeforeModal = card;
      openMediaModal(item.id, mediaType);
    }
  });

  // Auto-scroll al recibir foco (D-Pad)
  card.addEventListener('focus', () => {
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });

  return card;
}

/**
 * Muestra skeletons de carga en una fila
 */
function showRowSkeletons(scrollContainer, count = 10) {
  if (!scrollContainer) return;
  scrollContainer.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const sk = document.createElement('div');
    sk.className = 'row-card-skeleton';
    scrollContainer.appendChild(sk);
  }
}

/**
 * Carga las 4 filas horizontales del layout Netflix en paralelo
 */
async function loadHomeRows() {
  // Mostrar skeletons en todas las filas
  HOME_ROWS.forEach(row => {
    const scrollEl = document.getElementById(row.scrollId);
    showRowSkeletons(scrollEl, 10);
  });

  // Cargar datos de todas las filas en paralelo
  const rowPromises = HOME_ROWS.map(async (row) => {
    const scrollEl = document.getElementById(row.scrollId);
    if (!scrollEl) return;

    try {
      if (!CONFIG.getApiKey()) throw new Error('NO_API_KEY');

      const data = await fetchFromTMDb(row.endpoint, { ...row.params, page: 1 });
      const items = (data.results || []).filter(i => i.title || i.name).map(i => ({
        ...i,
        media_type: i.media_type || 'movie'
      }));

      scrollEl.innerHTML = '';
      const fragment = document.createDocumentFragment();
      items.forEach(item => fragment.appendChild(createRowCard(item)));
      scrollEl.appendChild(fragment);

    } catch (error) {
      console.warn(`[PelisFlix] Fila "${row.title}" en modo demo:`, error.message);
      // Fallback: usar items de demo
      scrollEl.innerHTML = '';
      const demoMovies = DEMO_ITEMS.filter(i => i.category === 'movie' || i.media_type === 'movie');
      const fragment = document.createDocumentFragment();
      demoMovies.forEach(item => fragment.appendChild(createRowCard(item)));
      scrollEl.appendChild(fragment);
    }
  });

  await Promise.allSettled(rowPromises);
}

/**
 * Renderiza los botones de género en el explorador de categorías
 */
function renderGenreButtons() {
  if (!dom.genreBtnGrid) return;
  dom.genreBtnGrid.innerHTML = '';

  const fragment = document.createDocumentFragment();
  TMDB_GENRES.forEach(genre => {
    const btn = document.createElement('button');
    btn.className = 'genre-filter-btn';
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('role', 'listitem');
    btn.setAttribute('data-genre-id', genre.id);
    btn.innerHTML = `<i class="${genre.icon}"></i> ${genre.name}`;

    btn.addEventListener('click', () => {
      // Marcar como activo
      dom.genreBtnGrid.querySelectorAll('.genre-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadGenreResults(genre.id, genre.name, 1);
    });

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        dom.genreBtnGrid.querySelectorAll('.genre-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadGenreResults(genre.id, genre.name, 1);
      }
    });

    btn.addEventListener('focus', () => {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });

    fragment.appendChild(btn);
  });

  dom.genreBtnGrid.appendChild(fragment);
}

/**
 * Muestra el explorador de categorías y oculta las filas Netflix
 */
function showCategoryExplorer() {
  if (dom.homeRowsContainer) dom.homeRowsContainer.classList.add('hidden');
  if (dom.heroBanner) dom.heroBanner.classList.add('hidden');
  if (dom.catalogSection) dom.catalogSection.classList.add('hidden');
  if (dom.categoryExplorer) dom.categoryExplorer.classList.remove('hidden');

  // Renderizar botones de género si aún no están
  if (dom.genreBtnGrid && dom.genreBtnGrid.children.length === 0) {
    renderGenreButtons();
  }

  // Scroll al explorador
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Foco al primer botón de género
  setTimeout(() => {
    const firstBtn = dom.genreBtnGrid.querySelector('.genre-filter-btn');
    if (firstBtn) focusAndCenter(firstBtn);
  }, 150);
}

/**
 * Oculta el explorador y vuelve al layout Netflix
 */
function hideCategoryExplorer() {
  if (dom.categoryExplorer) dom.categoryExplorer.classList.add('hidden');
  if (dom.heroBanner) dom.heroBanner.classList.remove('hidden');

  // Resetear estado del explorador
  state.explorer.activeGenreId = null;
  state.explorer.currentPage = 1;
  if (dom.exploreGrid) dom.exploreGrid.innerHTML = '';
  if (dom.explorerResultsTitle) dom.explorerResultsTitle.textContent = 'Selecciona un género para explorar';
  if (dom.exploreLoadMoreBtn) dom.exploreLoadMoreBtn.classList.add('hidden');
  if (dom.genreBtnGrid) {
    dom.genreBtnGrid.querySelectorAll('.genre-filter-btn').forEach(b => b.classList.remove('active'));
  }

  // Cargar de nuevo la pestaña activa
  loadActiveTab('movie', 1);
}

/**
 * Carga resultados filtrados por género desde TMDb
 */
async function loadGenreResults(genreId, genreName, page = 1) {
  state.explorer.activeGenreId = genreId;
  state.explorer.currentPage = page;

  if (dom.explorerResultsTitle) {
    dom.explorerResultsTitle.textContent = `Películas de ${genreName}`;
  }

  if (page === 1) {
    if (dom.exploreGrid) dom.exploreGrid.innerHTML = '';
    if (dom.explorerLoader) dom.explorerLoader.classList.remove('hidden');
  }

  try {
    if (!CONFIG.getApiKey()) throw new Error('NO_API_KEY');

    const data = await fetchFromTMDb('/discover/movie', {
      with_genres: genreId,
      sort_by: 'popularity.desc',
      page
    });

    state.explorer.totalPages = data.total_pages || 1;
    const items = (data.results || []).filter(i => i.title || i.name).map(i => ({
      ...i,
      media_type: 'movie'
    }));

    if (dom.explorerLoader) dom.explorerLoader.classList.add('hidden');

    if (!dom.exploreGrid) return;

    const fragment = document.createDocumentFragment();
    items.forEach(item => fragment.appendChild(createMediaCard(item)));
    dom.exploreGrid.appendChild(fragment);

    // Mostrar/ocultar botón Cargar Más
    if (dom.exploreLoadMoreBtn) {
      dom.exploreLoadMoreBtn.classList.toggle('hidden', page >= state.explorer.totalPages);
    }

  } catch (error) {
    console.warn('[PelisFlix] Explorador en modo demo:', error.message);
    if (dom.explorerLoader) dom.explorerLoader.classList.add('hidden');

    // Fallback con demo items
    const filtered = DEMO_ITEMS.filter(i => i.category === 'movie' || i.media_type === 'movie');
    if (dom.exploreGrid) {
      const fragment = document.createDocumentFragment();
      filtered.forEach(item => fragment.appendChild(createMediaCard(item)));
      dom.exploreGrid.appendChild(fragment);
    }
    if (dom.exploreLoadMoreBtn) dom.exploreLoadMoreBtn.classList.add('hidden');
  }
}

/**
 * Gestiona la visibilidad de las secciones según la pestaña activa
 */
function showMovieNetflixLayout() {
  if (dom.homeRowsContainer) dom.homeRowsContainer.classList.remove('hidden');
  if (dom.catalogSection) dom.catalogSection.classList.add('hidden');
  if (dom.categoryExplorer) dom.categoryExplorer.classList.add('hidden');
  if (dom.heroBanner) dom.heroBanner.classList.remove('hidden');
}

function showCatalogLayout() {
  if (dom.homeRowsContainer) dom.homeRowsContainer.classList.add('hidden');
  if (dom.catalogSection) dom.catalogSection.classList.remove('hidden');
  if (dom.categoryExplorer) dom.categoryExplorer.classList.add('hidden');
  if (dom.heroBanner) dom.heroBanner.classList.remove('hidden');
}

// ============================================================================
// 8. REPRODUCTOR MULTISERVIDOR Y MODAL FLOTANTE
// ============================================================================

function buildEmbedUrl(serverKey, playback) {
  const server = CONFIG.SERVERS[serverKey] || CONFIG.SERVERS.vidsrc;
  if (playback.type === 'movie') {
    return server.getMovieUrl(playback.id);
  } else {
    return server.getTvUrl(playback.id, playback.season, playback.episode);
  }
}

// ============================================================================
// FUNCIONES DE CONTROL DE PANTALLA COMPLETA (FULLSCREEN - SMART TV & WEB)
// ============================================================================

/**
 * Solicita pantalla completa con compatibilidad multidispositivo (Android TV, WebOS, Tizen, Webkit)
 */
function requestFullscreenSafe(element) {
  if (!element) return;
  try {
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(err => {
        console.warn('[PelisFlix] Solicitud de pantalla completa rechazada o no permitida:', err);
      });
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    }
  } catch (err) {
    console.warn('[PelisFlix] Error al solicitar pantalla completa:', err);
  }
}

/**
 * Sale del modo pantalla completa de forma segura
 */
function exitFullscreenSafe() {
  try {
    const isFull = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    if (isFull) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  } catch (err) {
    console.warn('[PelisFlix] Error saliendo de pantalla completa:', err);
  }
}

// ============================================================================
// AUTO-HIDE UI PARA LA BARRA DE CONTROLES DEL REPRODUCTOR (3S DE INACTIVIDAD)
// ============================================================================
let playerControlsTimer = null;
const PLAYER_CONTROLS_TIMEOUT_MS = 3000;

function isPlayerActive() {
  return dom.modalPlayerSection && !dom.modalPlayerSection.classList.contains('hidden');
}

function showPlayerControls() {
  if (!dom.playerTopBar) return;
  dom.playerTopBar.classList.remove('is-hidden', 'hidden');
}

function hidePlayerControls() {
  if (!isPlayerActive() || !dom.playerTopBar) return;

  // No ocultar si algún elemento interno de la barra (selector, botón) tiene foco activo
  if (dom.playerTopBar.contains(document.activeElement)) {
    resetPlayerControlsTimer();
    return;
  }

  dom.playerTopBar.classList.add('is-hidden', 'hidden');
}

function resetPlayerControlsTimer() {
  if (!isPlayerActive()) return;

  // Reaparecer inmediatamente ante cualquier interacción
  showPlayerControls();

  if (playerControlsTimer) {
    clearTimeout(playerControlsTimer);
    playerControlsTimer = null;
  }

  // Ocultar tras 3 segundos de inactividad
  playerControlsTimer = setTimeout(() => {
    hidePlayerControls();
  }, PLAYER_CONTROLS_TIMEOUT_MS);
}

function clearPlayerControlsTimer() {
  if (playerControlsTimer) {
    clearTimeout(playerControlsTimer);
    playerControlsTimer = null;
  }
  showPlayerControls();
}

function updateServerActiveBadge(serverKey) {
  const server = CONFIG.SERVERS[serverKey];
  if (!server) return;
  if (dom.serverBadgeText) {
    dom.serverBadgeText.textContent = server.badge || server.name;
  }
}

function playHlsStream(streamUrl, channelName = 'Canal') {
  if (!dom.liveTvPlayer) return;

  if (hlsInstance) {
    try {
      hlsInstance.destroy();
    } catch (e) {
      console.warn('[PelisFlix] Error al destruir HLS previo:', e);
    }
    hlsInstance = null;
  }

  // Validación de URL de transmisión
  if (!streamUrl || streamUrl === 'URL_M3U8_AQUI' || !streamUrl.startsWith('http')) {
    showToast(`Canal ${channelName}: Reemplaza "URL_M3U8_AQUI" por tu enlace .m3u8 en liveChannels.`);
    return;
  }

  if (window.Hls && Hls.isSupported()) {
    hlsInstance = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 60
    });

    hlsInstance.loadSource(streamUrl);
    hlsInstance.attachMedia(dom.liveTvPlayer);

    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      dom.liveTvPlayer.play().catch(e => {
        console.warn('[PelisFlix] Autoplay bloqueado por políticas del navegador:', e);
      });
    });

    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.warn('[PelisFlix] Error de red HLS, intentando reconectar...');
            hlsInstance.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.warn('[PelisFlix] Error de medios HLS, recuperando...');
            hlsInstance.recoverMediaError();
            break;
          default:
            console.error('[PelisFlix] Error fatal irrecuperable en HLS:', data);
            showToast(`No se pudo cargar la señal de ${channelName}.`);
            hlsInstance.destroy();
            hlsInstance = null;
            break;
        }
      }
    });
  } else if (dom.liveTvPlayer.canPlayType('application/vnd.apple.mpegurl')) {
    // Soporte HLS nativo (Safari en macOS/iOS, Smart TVs WebKit)
    dom.liveTvPlayer.src = streamUrl;
    dom.liveTvPlayer.addEventListener('loadedmetadata', () => {
      dom.liveTvPlayer.play().catch(e => console.warn('[PelisFlix] Autoplay bloqueado:', e));
    }, { once: true });
  } else {
    showToast('Tu navegador no cuenta con soporte para reproducción HLS');
  }
}

function openLiveChannel(channel) {
  if (!channel) return;
  state.lastFocusedElementBeforeModal = document.activeElement;

  stopAndClearPlayer();

  dom.modalHeroCover.classList.add('hidden');
  dom.modalTvEpisodes.classList.add('hidden');
  dom.mediaModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Ocultar iframe, mostrar reproductor de video nativo
  if (dom.videoPlayerIframe) {
    dom.videoPlayerIframe.src = '';
    dom.videoPlayerIframe.style.display = 'none';
  }
  if (dom.liveTvPlayer) {
    dom.liveTvPlayer.style.display = 'block';
  }

  const chNum = channel.number ? ` (Canal ${channel.number})` : '';
  const chCategory = channel.category || 'Nacional';
  const chDesc = channel.description || channel.desc || `Transmisión oficial de ${channel.name} en directo.`;

  // Metadatos en la barra de control del reproductor
  dom.playerPlayingTitle.innerHTML = `<span class="live-dot-pulse">🔴</span> ${channel.name} <span class="badge-live-stream">EN DIRECTO</span>`;
  dom.modalTitle.textContent = `${channel.name}${chNum}`;
  dom.modalTagline.textContent = `Transmisión oficial en vivo | ${chCategory}`;
  dom.modalRating.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> Señal HD`;
  dom.modalYear.textContent = '24/7';
  dom.modalDuration.textContent = 'En Vivo';
  dom.modalType.textContent = 'IPTV Streaming';
  dom.modalOverview.textContent = chDesc;

  const fallbackLogoSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect fill="%231a1a1a" width="300" height="450"/><text fill="%23E50914" font-family="sans-serif" font-size="22" dy="10" font-weight="bold" x="50%" y="50%" text-anchor="middle">${channel.name}</text></svg>`;
  dom.modalPoster.onerror = () => {
    dom.modalPoster.onerror = null;
    dom.modalPoster.src = fallbackLogoSvg;
  };
  dom.modalPoster.src = channel.logo || fallbackLogoSvg;
  dom.modalGenres.innerHTML = `<span class="genre-tag">${chCategory}</span><span class="genre-tag">IPTV</span><span class="genre-tag">HLS</span>`;

  // Ocultar selector de servidores de películas (en TV en vivo es HLS directo)
  if (dom.serverSelect && dom.serverSelect.parentElement) {
    dom.serverSelect.parentElement.style.display = 'none';
  }
  if (dom.serverActiveBadge) {
    dom.serverActiveBadge.style.display = 'none';
  }
  if (dom.quickSwitchServerBtn) {
    dom.quickSwitchServerBtn.style.display = 'none';
  }

  dom.modalPlayerSection.classList.remove('hidden');

  // Reproducción HLS del canal
  playHlsStream(channel.stream_url, channel.name);

  // Activación automática de pantalla completa para Smart TV y Móviles
  setTimeout(() => {
    requestFullscreenSafe(dom.modalPlayerSection);
  }, 120);

  resetPlayerControlsTimer();
}

function startPlayback(playbackData) {
  state.currentPlayback = { ...playbackData };

  // Detener y destruir HLS si estaba activo
  if (hlsInstance) {
    try {
      hlsInstance.destroy();
    } catch (e) {}
    hlsInstance = null;
  }
  if (dom.liveTvPlayer) {
    dom.liveTvPlayer.pause();
    dom.liveTvPlayer.removeAttribute('src');
    dom.liveTvPlayer.src = '';
    dom.liveTvPlayer.load();
    dom.liveTvPlayer.style.display = 'none';
  }

  // Mostrar iframe y controles multiservidor
  if (dom.videoPlayerIframe) {
    dom.videoPlayerIframe.style.display = 'block';
  }
  if (dom.serverSelect && dom.serverSelect.parentElement) {
    dom.serverSelect.parentElement.style.display = '';
  }

  const url = buildEmbedUrl(state.selectedServer, state.currentPlayback);

  dom.playerPlayingTitle.textContent = state.currentPlayback.title;
  if (dom.serverSelect) dom.serverSelect.value = state.selectedServer;
  updateServerActiveBadge(state.selectedServer);
  dom.videoPlayerIframe.src = url;
  dom.modalPlayerSection.classList.remove('hidden');

  // ACTIVACIÓN AUTOMÁTICA DE PANTALLA COMPLETA
  requestFullscreenSafe(dom.modalPlayerSection);

  // Llevar foco al selector de servidores o botón de volver
  focusAndCenter(dom.serverSelect);

  // Iniciar auto-ocultamiento tras 3 segundos de inactividad
  resetPlayerControlsTimer();
}

function handleServerChange(newServerKey) {
  if (!CONFIG.SERVERS[newServerKey]) return;
  state.selectedServer = newServerKey;
  if (dom.serverSelect) dom.serverSelect.value = newServerKey;
  updateServerActiveBadge(newServerKey);

  if (state.currentPlayback && state.currentPlayback.id) {
    const newUrl = buildEmbedUrl(newServerKey, state.currentPlayback);
    dom.videoPlayerIframe.src = newUrl;
    showToast(`Cambiado a: ${CONFIG.SERVERS[newServerKey].name}`);
  }
}

function cycleNextServer() {
  const serverKeys = Object.keys(CONFIG.SERVERS);
  const currentIndex = serverKeys.indexOf(state.selectedServer);
  const nextIndex = (currentIndex + 1) % serverKeys.length;
  const nextKey = serverKeys[nextIndex];
  handleServerChange(nextKey);
}

function stopAndClearPlayer() {
  // Limpiar temporizador y restaurar controles visibles para la próxima reproducción
  clearPlayerControlsTimer();

  // Salir de pantalla completa si estaba activa
  exitFullscreenSafe();

  if (dom.videoPlayerIframe) {
    dom.videoPlayerIframe.src = '';
    dom.videoPlayerIframe.style.display = 'block';
  }

  // Detener y destruir HLS asegurando cortar el audio por completo
  if (hlsInstance) {
    try {
      hlsInstance.destroy();
    } catch (e) {
      console.warn('[PelisFlix] Error destruyendo instancia HLS:', e);
    }
    hlsInstance = null;
  }

  if (dom.liveTvPlayer) {
    dom.liveTvPlayer.pause();
    dom.liveTvPlayer.removeAttribute('src');
    dom.liveTvPlayer.src = '';
    dom.liveTvPlayer.load();
    dom.liveTvPlayer.style.display = 'none';
  }

  if (dom.serverSelect && dom.serverSelect.parentElement) {
    dom.serverSelect.parentElement.style.display = '';
  }
  if (dom.serverActiveBadge) {
    dom.serverActiveBadge.style.display = '';
  }
  if (dom.quickSwitchServerBtn) {
    dom.quickSwitchServerBtn.style.display = '';
  }

  dom.modalPlayerSection.classList.add('hidden');
  dom.playerPlayingTitle.textContent = '';
  state.currentPlayback = { type: null, id: null, season: 1, episode: 1, title: '' };
}

function closeMediaModal() {
  stopAndClearPlayer();
  dom.mediaModal.classList.add('hidden');
  document.body.style.overflow = '';
  state.activeItemDetails = null;

  // Restaurar foco al elemento que abrió el modal
  if (state.lastFocusedElementBeforeModal) {
    focusAndCenter(state.lastFocusedElementBeforeModal);
  }
}

async function openMediaModal(id, mediaType, autoPlay = false) {
  stopAndClearPlayer();
  dom.modalHeroCover.classList.remove('hidden');
  dom.modalTvEpisodes.classList.add('hidden');
  dom.episodesContainer.innerHTML = '';
  dom.mediaModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Enfocar botón de cerrar o acción principal
  focusAndCenter(dom.modalPlayBtn);

  try {
    let details = null;

    if (CONFIG.getApiKey()) {
      details = await getMediaDetails(mediaType, id);
    } else {
      details = DEMO_ITEMS.find(i => i.id == id) || {
        id,
        title: mediaType === 'movie' ? 'Película en Streaming' : 'Serie en Streaming',
        overview: 'Disfruta de la mejor calidad. Para ver la cartelera completa en tiempo real de TMDb, ingresa tu API Key en el menú lateral.',
        vote_average: 8.2,
        media_type: mediaType,
        genres: [{ name: 'Acción' }, { name: 'Aventura' }]
      };
    }

    state.activeItemDetails = { ...details, media_type: mediaType };

    const isMovie = mediaType === 'movie';
    const title = details.title || details.name || 'Sin Título';
    const year = formatYear(details.release_date || details.first_air_date);
    const rating = details.vote_average ? details.vote_average.toFixed(1) : 'S/R';
    const overview = details.overview || 'Sinopsis no disponible en español en este momento.';
    const tagline = details.tagline || '';
    const duration = isMovie 
      ? (details.runtime ? `${details.runtime} min` : 'Duración estándar')
      : (details.number_of_seasons ? `${details.number_of_seasons} Temporada(s)` : 'Serie TV');

    dom.modalTitle.textContent = title;
    dom.modalTagline.textContent = tagline ? `"${tagline}"` : '';
    dom.modalRating.innerHTML = `<i class="fa-solid fa-star"></i> ${rating}`;
    dom.modalYear.textContent = year;
    dom.modalDuration.textContent = duration;
    dom.modalType.textContent = isMovie ? 'Película' : 'Serie TV';
    dom.modalOverview.textContent = overview;

    const backdropUrl = details.backdrop_path 
      ? `${CONFIG.BACKDROP_BASE_URL}${details.backdrop_path}` 
      : (details.poster_path ? `${CONFIG.IMAGE_BASE_URL}${details.poster_path}` : '');

    if (backdropUrl) {
      dom.modalHeroCover.style.backgroundImage = `url("${backdropUrl}")`;
    } else {
      dom.modalHeroCover.style.backgroundImage = 'none';
      dom.modalHeroCover.style.backgroundColor = '#181818';
    }

    dom.modalPoster.src = details.poster_path 
      ? `${CONFIG.IMAGE_BASE_URL}${details.poster_path}` 
      : CONFIG.FALLBACK_POSTER;

    dom.modalGenres.innerHTML = '';
    if (details.genres && details.genres.length > 0) {
      details.genres.forEach(g => {
        const span = document.createElement('span');
        span.className = 'genre-tag';
        span.textContent = g.name;
        dom.modalGenres.appendChild(span);
      });
    }

    if (!isMovie) {
      setupTvSeriesModal(details);
    }

    if (autoPlay) {
      if (isMovie) {
        startPlayback({ type: 'movie', id: details.id, title: `Película: ${title}` });
      } else {
        startPlayback({ type: 'tv', id: details.id, season: 1, episode: 1, title: `${title} - T1:E1` });
      }
    }

  } catch (error) {
    console.error('Error al abrir modal:', error);
    showToast('No se pudieron cargar los detalles del título');
  }
}

async function setupTvSeriesModal(seriesDetails) {
  dom.modalTvEpisodes.classList.remove('hidden');
  dom.seasonSelect.innerHTML = '';

  const seasons = (seriesDetails.seasons || []).filter(s => s.season_number > 0);
  const totalSeasons = seasons.length > 0 ? seasons.length : (seriesDetails.number_of_seasons || 1);

  for (let i = 1; i <= totalSeasons; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Temporada ${i}`;
    dom.seasonSelect.appendChild(opt);
  }

  state.activeSeason = 1;
  await loadSeasonEpisodes(seriesDetails.id, 1);

  dom.seasonSelect.onchange = async (e) => {
    const s = parseInt(e.target.value, 10);
    state.activeSeason = s;
    await loadSeasonEpisodes(seriesDetails.id, s);
  };
}

async function loadSeasonEpisodes(tvId, seasonNumber) {
  dom.episodesLoader.classList.remove('hidden');
  dom.episodesContainer.innerHTML = '';

  try {
    let episodes = [];

    if (CONFIG.getApiKey()) {
      const data = await getSeasonEpisodes(tvId, seasonNumber);
      episodes = data.episodes || [];
    } else {
      episodes = Array.from({ length: 8 }, (_, i) => ({
        episode_number: i + 1,
        name: `Episodio ${i + 1}`,
        overview: `Capítulo ${i + 1} de la temporada ${seasonNumber}. Trama en desarrollo en PelisFlix.`,
        still_path: null
      }));
    }

    dom.episodesLoader.classList.add('hidden');

    if (episodes.length === 0) {
      dom.episodesContainer.innerHTML = '<p style="color:var(--text-muted); padding:10px;">No hay información disponible para esta temporada.</p>';
      return;
    }

    episodes.forEach(ep => {
      const card = document.createElement('div');
      card.className = 'episode-card';
      card.setAttribute('tabindex', '0'); // Habilitado para D-Pad
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Episodio ${ep.episode_number}: ${ep.name}`);

      const stillSrc = ep.still_path ? `${CONFIG.IMAGE_BASE_URL}${ep.still_path}` : CONFIG.FALLBACK_POSTER;

      card.innerHTML = `
        <div class="episode-thumb-wrapper">
          <img src="${stillSrc}" alt="${ep.name}" class="episode-thumb" loading="lazy" />
          <div class="episode-play-badge"><i class="fa-solid fa-play"></i></div>
        </div>
        <div class="episode-info">
          <div class="episode-title-row">
            <span class="episode-number">E${ep.episode_number}</span>
            <span class="episode-title">${ep.name}</span>
          </div>
          <p class="episode-overview">${ep.overview || 'Sin descripción disponible.'}</p>
        </div>
        <div>
          <button class="btn btn-primary btn-sm" tabindex="-1"><i class="fa-solid fa-play"></i> Ver</button>
        </div>
      `;

      const triggerPlay = () => {
        document.querySelectorAll('.episode-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        const seriesTitle = dom.modalTitle.textContent;
        startPlayback({
          type: 'tv',
          id: tvId,
          season: seasonNumber,
          episode: ep.episode_number,
          title: `${seriesTitle} - T${seasonNumber}:E${ep.episode_number} (${ep.name})`
        });
      };

      card.addEventListener('click', triggerPlay);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') triggerPlay();
      });

      card.addEventListener('focus', () => {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      dom.episodesContainer.appendChild(card);
    });

  } catch (err) {
    dom.episodesLoader.classList.add('hidden');
    dom.episodesContainer.innerHTML = '<p style="color:var(--text-muted);">No se pudieron cargar los episodios.</p>';
  }
}

// ============================================================================
// 9. NAVEGACIÓN, BÚSQUEDA Y CARGA DE DATOS
// ============================================================================

async function loadActiveTab(tab = state.currentTab, page = 1) {
  state.currentTab = tab;
  state.currentPage = page;
  state.searchQuery = '';
  if (dom.modalSearchInput) dom.modalSearchInput.value = '';
  if (dom.modalClearSearchBtn) dom.modalClearSearchBtn.classList.add('hidden');

  // Actualizar estado activo en la barra de pestañas (Sub-Navbar)
  if (dom.navTabButtons) {
    dom.navTabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === tab);
    });
  }

  // ===========================================================
  // PESTAÑA PELÍCULAS: LAYOUT NETFLIX CON FILAS HORIZONTALES
  // ===========================================================
  if (tab === 'movie') {
    showMovieNetflixLayout();
    closeSidebar();

    // Cargar Hero con película destacada
    try {
      if (CONFIG.getApiKey()) {
        const heroData = await fetchFromTMDb('/trending/movie/week', { page: 1 });
        const heroItems = (heroData.results || []).filter(i => i.title).map(i => ({ ...i, media_type: 'movie' }));
        if (heroItems.length > 0) renderHero(heroItems[0]);
      } else {
        const demoHero = DEMO_ITEMS.find(i => i.category === 'movie');
        if (demoHero) renderHero(demoHero);
      }
    } catch (e) {
      const demoHero = DEMO_ITEMS.find(i => i.category === 'movie');
      if (demoHero) renderHero(demoHero);
    }

    // Cargar las 4 filas del layout Netflix
    loadHomeRows();
    return;
  }

  // ===========================================================
  // PESTAÑA TV EN VIVO: CANALES IPTV
  // ===========================================================
  if (tab === 'live') {
    showCatalogLayout();
    dom.sectionTitle.textContent = 'TV en Vivo - Canales en Directo';
    dom.sectionSubtitle.textContent = 'Transmisiones oficiales y señales 24/7 sin cortes';
    dom.resultsCount.textContent = `${liveChannels.length} canales disponibles`;
    renderLiveChannels(liveChannels);
    closeSidebar();
    return;
  }

  // ===========================================================
  // PESTAÑAS SERIES, ANIME, DIBUJOS ANIMADOS: GRILLA ESTÁNDAR
  // ===========================================================
  showCatalogLayout();

  const titles = {
    tv: { title: 'Series de Televisión', subtitle: 'Las mejores series y producciones para maratonear', defaultType: 'tv' },
    anime: { title: 'Anime Japonés', subtitle: 'Lo mejor de la animación nipona, shonen, seinen y más', defaultType: 'tv' },
    cartoons: { title: 'Dibujos Animados', subtitle: 'Grandes producciones de animación occidental para toda la familia', defaultType: 'tv' }
  };

  const meta = titles[tab] || titles.tv;
  dom.sectionTitle.textContent = meta.title;
  dom.sectionSubtitle.textContent = meta.subtitle;
  dom.resultsCount.textContent = '';

  if (page === 1) {
    showSkeletons(12);
  } else {
    dom.loader.classList.remove('hidden');
  }

  closeSidebar();

  try {
    let data;
    if (tab === 'tv') data = await getSeries(page);
    else if (tab === 'anime') data = await getAnime(page);
    else if (tab === 'cartoons') data = await getCartoons(page);
    else data = await getSeries(page);

    state.totalPages = data.total_pages || 1;
    const rawItems = data.results || [];
    const defaultType = meta.defaultType || 'tv';
    const items = rawItems.map(i => ({
      ...i,
      media_type: i.media_type || defaultType
    }));

    if (page === 1 && items.length > 0) {
      renderHero(items[0]);
    }

    renderMediaGrid(items, page > 1);

    if (dom.loadMoreBtn) {
      dom.loadMoreBtn.classList.toggle('hidden', state.currentPage >= state.totalPages);
    }

  } catch (error) {
    console.warn(`[PelisFlix] Modo demostración (${error.message}).`);

    let items = DEMO_ITEMS;
    if (tab === 'tv') items = DEMO_ITEMS.filter(i => i.category === 'tv');
    else if (tab === 'anime') items = DEMO_ITEMS.filter(i => i.category === 'anime');
    else if (tab === 'cartoons') items = DEMO_ITEMS.filter(i => i.category === 'cartoons');

    if (page === 1 && items.length > 0) {
      renderHero(items[0]);
    }

    renderMediaGrid(items, false);
    if (dom.loadMoreBtn) dom.loadMoreBtn.classList.add('hidden');
  } finally {
    dom.loader.classList.add('hidden');
  }
}

async function performSearch(query) {
  const clean = query.trim();
  if (!clean) {
    loadActiveTab('trending', 1);
    return;
  }

  state.currentTab = 'search';
  state.searchQuery = clean;
  state.currentPage = 1;

  dom.sectionTitle.textContent = `Resultados para "${clean}"`;
  dom.sectionSubtitle.textContent = 'Búsqueda en tiempo real en PelisFlix';
  dom.sidebarNavButtons.forEach(btn => btn.classList.remove('active'));

  showSkeletons(8);

  try {
    const data = await searchMulti(clean, 1);
    const results = (data.results || []).filter(i => i.media_type === 'movie' || i.media_type === 'tv');

    dom.resultsCount.textContent = `${results.length} título(s) encontrados`;
    renderMediaGrid(results, false);

    if (results.length > 0) {
      renderHero(results[0]);
    }
  } catch (error) {
    const filtered = DEMO_ITEMS.filter(i => 
      (i.title && i.title.toLowerCase().includes(clean.toLowerCase())) ||
      (i.name && i.name.toLowerCase().includes(clean.toLowerCase()))
    );
    dom.resultsCount.textContent = `${filtered.length} título(s) locales`;
    renderMediaGrid(filtered, false);
  }
}

// ============================================================================
// 10. GESTIÓN DEL MENÚ LATERAL (ABRE POR BOTÓN, CONTROL REMOTO O TOUCH)
// ============================================================================

function openSidebar() {
  dom.rightSidebar.classList.add('is-open');
  dom.sidebarOverlay.classList.remove('hidden');

  // Mover foco automáticamente al primer elemento en el sidebar
  setTimeout(() => {
    const firstBtn = dom.rightSidebar.querySelector('.sidebar-nav-btn') || dom.configMenuBtn;
    focusAndCenter(firstBtn);
  }, 100);
}

function closeSidebar() {
  dom.rightSidebar.classList.remove('is-open');
  dom.sidebarOverlay.classList.add('hidden');
}

function toggleSidebar() {
  if (dom.rightSidebar.classList.contains('is-open')) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

// ============================================================================
// 10.B GESTIÓN DEL MODAL DEDICADO DE BÚSQUEDA (SMART TV & MÓVILES)
// ============================================================================

function getSearchGridColumnsCount() {
  if (!dom.searchResultsGrid) return 1;
  const cards = Array.from(dom.searchResultsGrid.querySelectorAll('.media-card'));
  if (cards.length < 2) return 1;
  const firstTop = cards[0].offsetTop;
  let count = 0;
  for (const c of cards) {
    if (Math.abs(c.offsetTop - firstTop) < 12) count++;
    else break;
  }
  return Math.max(1, count);
}

function openSearchModal() {
  closeSidebar();
  if (!dom.searchModal) return;
  dom.searchModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  state.lastFocusedElementBeforeModal = dom.headerSearchBtn;

  if (dom.modalSearchInput && !dom.modalSearchInput.value.trim()) {
    renderSearchInitialState();
  } else if (dom.modalClearSearchBtn && dom.modalSearchInput && dom.modalSearchInput.value.trim()) {
    dom.modalClearSearchBtn.classList.remove('hidden');
  }

  // Foco automático obligatorio para desplegar teclado en pantalla en Smart TV y celulares
  setTimeout(() => {
    if (dom.modalSearchInput) {
      dom.modalSearchInput.focus();
      dom.modalSearchInput.select();
    }
  }, 80);
}

function closeSearchModal() {
  if (!dom.searchModal) return;
  dom.searchModal.classList.add('hidden');
  document.body.style.overflow = '';

  if (dom.headerSearchBtn) {
    focusAndCenter(dom.headerSearchBtn);
  }
}

function renderSearchInitialState() {
  if (!dom.searchResultsGrid) return;
  dom.searchResultsGrid.innerHTML = `
    <div class="search-empty-state">
      <i class="fa-solid fa-magnifying-glass"></i>
      <h3>Encuentra tus películas y series favoritas</h3>
      <p>Escribe el nombre del título, saga, director o actor para ver resultados al instante.</p>
    </div>
  `;
  if (dom.searchStatusText) {
    dom.searchStatusText.innerHTML = '<i class="fa-solid fa-compass"></i> Ingresa un término para comenzar a buscar';
  }
  if (dom.searchModalLoader) {
    dom.searchModalLoader.classList.add('hidden');
  }
  if (dom.modalClearSearchBtn) {
    dom.modalClearSearchBtn.classList.add('hidden');
  }
}

async function performModalSearch(query) {
  const clean = (query || '').trim();
  if (!clean) {
    renderSearchInitialState();
    return;
  }

  if (dom.modalClearSearchBtn) dom.modalClearSearchBtn.classList.remove('hidden');
  if (dom.searchModalLoader) dom.searchModalLoader.classList.remove('hidden');
  if (dom.searchStatusText) dom.searchStatusText.textContent = `Buscando "${clean}"...`;

  try {
    let results = [];
    if (CONFIG.getApiKey()) {
      const data = await searchMulti(clean, 1);
      results = (data.results || []).filter(i => (i.media_type === 'movie' || i.media_type === 'tv') && (i.title || i.name));
    } else {
      results = DEMO_ITEMS.filter(i =>
        (i.title && i.title.toLowerCase().includes(clean.toLowerCase())) ||
        (i.name && i.name.toLowerCase().includes(clean.toLowerCase()))
      );
    }

    if (dom.searchModalLoader) dom.searchModalLoader.classList.add('hidden');

    if (results.length === 0) {
      if (dom.searchStatusText) dom.searchStatusText.textContent = `0 resultados para "${clean}"`;
      if (dom.searchResultsGrid) {
        dom.searchResultsGrid.innerHTML = `
          <div class="search-empty-state">
            <i class="fa-solid fa-film"></i>
            <h3>No se encontraron títulos</h3>
            <p>No hay coincidencias para "${clean}". Intenta con otro término o revisa la ortografía.</p>
          </div>
        `;
      }
      return;
    }

    if (dom.searchStatusText) dom.searchStatusText.textContent = `${results.length} título(s) encontrados para "${clean}"`;
    if (dom.searchResultsGrid) {
      dom.searchResultsGrid.innerHTML = '';
      const fragment = document.createDocumentFragment();
      results.forEach(item => {
        fragment.appendChild(createSearchMediaCard(item));
      });
      dom.searchResultsGrid.appendChild(fragment);
    }

  } catch (error) {
    console.warn('[PelisFlix] Error al buscar en TMDb, usando catálogo de demostración:', error);
    if (dom.searchModalLoader) dom.searchModalLoader.classList.add('hidden');

    const filtered = DEMO_ITEMS.filter(i =>
      (i.title && i.title.toLowerCase().includes(clean.toLowerCase())) ||
      (i.name && i.name.toLowerCase().includes(clean.toLowerCase()))
    );

    if (dom.searchStatusText) dom.searchStatusText.textContent = `${filtered.length} título(s) locales para "${clean}"`;
    if (dom.searchResultsGrid) {
      dom.searchResultsGrid.innerHTML = '';
      const fragment = document.createDocumentFragment();
      filtered.forEach(item => {
        fragment.appendChild(createSearchMediaCard(item));
      });
      dom.searchResultsGrid.appendChild(fragment);
    }
  }
}

// ============================================================================
// 10.C GESTIÓN DE CONFIGURACIÓN Y ACCESO POR PIN ("Pia26")
// ============================================================================

function openPinModal() {
  closeSidebar();
  if (dom.pinInput) dom.pinInput.value = '';
  if (dom.pinError) dom.pinError.classList.add('hidden');
  dom.pinModal.classList.remove('hidden');
  
  // Auto-focus obligatorio para Smart TV (despliega teclado en pantalla) y celulares
  setTimeout(() => {
    if (dom.pinInput) {
      dom.pinInput.focus();
      dom.pinInput.select();
    }
  }, 100);
}

function closePinModal() {
  dom.pinModal.classList.add('hidden');
  if (dom.pinInput) dom.pinInput.value = '';
  if (dom.pinError) dom.pinError.classList.add('hidden');
  if (dom.configMenuBtn) {
    focusAndCenter(dom.configMenuBtn);
  }
}

function verifyPin() {
  const entered = (dom.pinInput.value || '').trim();
  if (entered === ADMIN_PIN) {
    dom.pinError.classList.add('hidden');
    dom.pinModal.classList.add('hidden');
    if (dom.pinInput) dom.pinInput.value = '';
    openSettingsModal();
  } else {
    dom.pinError.classList.remove('hidden');
    if (dom.pinInput) {
      dom.pinInput.value = '';
      dom.pinInput.focus();
    }
  }
}

function openSettingsModal() {
  updateApiKeyStatus();
  dom.settingsModal.classList.remove('hidden');
  setTimeout(() => {
    if (dom.apiKeyInput) {
      dom.apiKeyInput.focus();
      dom.apiKeyInput.select();
    }
  }, 100);
}

function closeSettingsModal() {
  dom.settingsModal.classList.add('hidden');
  if (dom.configMenuBtn) {
    focusAndCenter(dom.configMenuBtn);
  }
}

// ============================================================================
// 11. MOTOR DE NAVEGACIÓN D-PAD ESPACIAL (SMART TV: TIZEN / WEBOS / ANDROID TV)
// ============================================================================

function getGridColumnsCount() {
  const cards = Array.from(document.querySelectorAll('.media-card, .live-channel-card'));
  if (cards.length < 2) return 1;
  const firstTop = cards[0].offsetTop;
  let count = 0;
  for (const c of cards) {
    if (Math.abs(c.offsetTop - firstTop) < 10) count++;
    else break;
  }
  return Math.max(1, count);
}

function handleDpadNavigation(e) {
  const isDpadKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
  const isBackKey = e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === 10009 || e.keyCode === 461;

  // 1. MANEJO DEL BOTÓN VOLVER / ATRÁS EN SMART TV Y PANTALLA COMPLETA
  if (isBackKey) {
    // Si el foco está dentro de un input de texto, permitir que Backspace borre caracteres
    if (e.target.tagName === 'INPUT' && e.key === 'Backspace') {
      return;
    }

    e.preventDefault();

    // Si el modal de búsqueda está abierto -> Cerrar modal de búsqueda
    if (dom.searchModal && !dom.searchModal.classList.contains('hidden')) {
      closeSearchModal();
      return;
    }

    // Si el modal de PIN está abierto -> Cerrar modal de PIN
    if (dom.pinModal && !dom.pinModal.classList.contains('hidden')) {
      closePinModal();
      return;
    }

    // Si el modal de Ajustes está abierto -> Cerrar modal de Ajustes
    if (dom.settingsModal && !dom.settingsModal.classList.contains('hidden')) {
      closeSettingsModal();
      return;
    }

    // Si el reproductor de video está activo (en pantalla completa o en modal), detenerlo y salir
    if (!dom.modalPlayerSection.classList.contains('hidden')) {
      stopAndClearPlayer();
      focusAndCenter(dom.modalPlayBtn);
      return;
    }

    // Si el modal de detalles está abierto -> Cerrar modal
    if (!dom.mediaModal.classList.contains('hidden')) {
      closeMediaModal();
      return;
    }

    // Si el menú lateral está abierto -> Cerrar menú lateral y volver a botón de menú
    if (dom.rightSidebar.classList.contains('is-open')) {
      closeSidebar();
      focusAndCenter(dom.sidebarToggleBtn);
      return;
    }
  }

  // Si el reproductor de video está activo, cualquier tecla reinicia el temporizador de controles
  if (isPlayerActive()) {
    resetPlayerControlsTimer();

    if (isDpadKey) {
      e.preventDefault();
      const playerControls = [dom.serverSelect, dom.quickSwitchServerBtn, dom.playerCloseViewBtn].filter(Boolean);
      const idx = playerControls.indexOf(active);

      if (idx === -1) {
        focusAndCenter(dom.serverSelect || dom.playerCloseViewBtn);
      } else {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          const next = playerControls[idx + 1] || playerControls[0];
          focusAndCenter(next);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          const prev = playerControls[idx - 1] || playerControls[playerControls.length - 1];
          focusAndCenter(prev);
        }
      }
      return;
    }
  }

  // Si no es tecla de dirección, continuar
  if (!isDpadKey) return;

  const active = document.activeElement;

  // 1.A NAVEGACIÓN DENTRO DEL MODAL DE BÚSQUEDA
  if (dom.searchModal && !dom.searchModal.classList.contains('hidden')) {
    // Foco en el input de búsqueda
    if (active === dom.modalSearchInput) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const firstCard = dom.searchResultsGrid.querySelector('.media-card');
        if (firstCard) {
          focusAndCenter(firstCard);
        } else if (dom.modalClearSearchBtn && !dom.modalClearSearchBtn.classList.contains('hidden')) {
          focusAndCenter(dom.modalClearSearchBtn);
        } else if (dom.searchModalCloseBtn) {
          focusAndCenter(dom.searchModalCloseBtn);
        }
      } else if (e.key === 'ArrowRight' && dom.modalSearchInput.selectionStart === dom.modalSearchInput.value.length) {
        if (dom.modalClearSearchBtn && !dom.modalClearSearchBtn.classList.contains('hidden')) {
          e.preventDefault();
          focusAndCenter(dom.modalClearSearchBtn);
        } else if (dom.searchModalCloseBtn) {
          e.preventDefault();
          focusAndCenter(dom.searchModalCloseBtn);
        }
      }
      return;
    }

    // Foco en el botón de limpiar texto
    if (active === dom.modalClearSearchBtn) {
      e.preventDefault();
      if (e.key === 'ArrowLeft') focusAndCenter(dom.modalSearchInput);
      else if (e.key === 'ArrowRight') focusAndCenter(dom.searchModalCloseBtn);
      else if (e.key === 'ArrowDown') {
        const firstCard = dom.searchResultsGrid.querySelector('.media-card');
        if (firstCard) focusAndCenter(firstCard);
      }
      return;
    }

    // Foco en el botón de cerrar modal de búsqueda
    if (active === dom.searchModalCloseBtn) {
      e.preventDefault();
      if (e.key === 'ArrowLeft') {
        if (dom.modalClearSearchBtn && !dom.modalClearSearchBtn.classList.contains('hidden')) {
          focusAndCenter(dom.modalClearSearchBtn);
        } else {
          focusAndCenter(dom.modalSearchInput);
        }
      } else if (e.key === 'ArrowDown') {
        const firstCard = dom.searchResultsGrid.querySelector('.media-card');
        if (firstCard) focusAndCenter(firstCard);
      }
      return;
    }

    // Foco en una tarjeta dentro de la grilla de resultados del modal
    const searchCards = Array.from(dom.searchResultsGrid.querySelectorAll('.media-card'));
    const scIndex = searchCards.indexOf(active);
    if (scIndex !== -1) {
      e.preventDefault();
      const cols = getSearchGridColumnsCount();

      if (e.key === 'ArrowRight') {
        if (scIndex + 1 < searchCards.length) {
          focusAndCenter(searchCards[scIndex + 1]);
        }
      } else if (e.key === 'ArrowLeft') {
        if (scIndex > 0) {
          focusAndCenter(searchCards[scIndex - 1]);
        }
      } else if (e.key === 'ArrowDown') {
        if (scIndex + cols < searchCards.length) {
          focusAndCenter(searchCards[scIndex + cols]);
        }
      } else if (e.key === 'ArrowUp') {
        if (scIndex - cols >= 0) {
          focusAndCenter(searchCards[scIndex - cols]);
        } else {
          // Subir al input de búsqueda desde la primera fila
          focusAndCenter(dom.modalSearchInput);
        }
      }
      return;
    }
  }

  // 1.B NAVEGACIÓN DENTRO DEL MODAL DE PIN
  if (dom.pinModal && !dom.pinModal.classList.contains('hidden')) {
    e.preventDefault();
    const pinFocusables = Array.from(dom.pinModal.querySelectorAll('input, button, [tabindex="0"]'))
      .filter(el => !el.classList.contains('hidden') && el.offsetParent !== null);
    const currentIndex = pinFocusables.indexOf(active);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      const next = pinFocusables[currentIndex + 1] || pinFocusables[0];
      focusAndCenter(next);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      const prev = pinFocusables[currentIndex - 1] || pinFocusables[pinFocusables.length - 1];
      focusAndCenter(prev);
    }
    return;
  }

  // 1.C NAVEGACIÓN DENTRO DEL MODAL DE AJUSTES
  if (dom.settingsModal && !dom.settingsModal.classList.contains('hidden')) {
    e.preventDefault();
    const settingsFocusables = Array.from(dom.settingsModal.querySelectorAll('input, button, [tabindex="0"]'))
      .filter(el => !el.classList.contains('hidden') && el.offsetParent !== null);
    const currentIndex = settingsFocusables.indexOf(active);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      const next = settingsFocusables[currentIndex + 1] || settingsFocusables[0];
      focusAndCenter(next);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      const prev = settingsFocusables[currentIndex - 1] || settingsFocusables[settingsFocusables.length - 1];
      focusAndCenter(prev);
    }
    return;
  }

  // 2. NAVEGACIÓN DENTRO DEL MODAL FLOTANTE
  if (!dom.mediaModal.classList.contains('hidden')) {
    e.preventDefault();
    const modalFocusables = Array.from(dom.mediaModal.querySelectorAll('button, select, [tabindex="0"]'))
      .filter(el => !el.classList.contains('hidden') && el.offsetParent !== null);

    const currentIndex = modalFocusables.indexOf(active);

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      const next = modalFocusables[currentIndex + 1] || modalFocusables[0];
      focusAndCenter(next);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      const prev = modalFocusables[currentIndex - 1] || modalFocusables[modalFocusables.length - 1];
      focusAndCenter(prev);
    }
    return;
  }

  // 3. NAVEGACIÓN DENTRO DEL PANEL LATERAL
  if (dom.rightSidebar.classList.contains('is-open')) {
    e.preventDefault();
    const sidebarFocusables = Array.from(dom.rightSidebar.querySelectorAll('button, input, [tabindex="0"]'))
      .filter(el => !el.classList.contains('hidden') && el.offsetParent !== null);

    const currentIndex = sidebarFocusables.indexOf(active);

    if (e.key === 'ArrowDown') {
      const next = sidebarFocusables[currentIndex + 1] || sidebarFocusables[0];
      focusAndCenter(next);
    } else if (e.key === 'ArrowUp') {
      const prev = sidebarFocusables[currentIndex - 1] || sidebarFocusables[sidebarFocusables.length - 1];
      focusAndCenter(prev);
    } else if (e.key === 'ArrowLeft') {
      // Salir del menú lateral hacia el contenido principal
      closeSidebar();
      focusAndCenter(dom.sidebarToggleBtn);
    }
    return;
  }

  // 4. NAVEGACIÓN ESPACIAL EN LA PANTALLA PRINCIPAL

  // 4.A NAVEGACIÓN EN LAS FILAS HORIZONTALES (LAYOUT NETFLIX)
  if (active && active.classList.contains('row-card')) {
    e.preventDefault();
    const parentRow = active.closest('.row-scroll');
    if (!parentRow) return;
    const rowCards = Array.from(parentRow.querySelectorAll('.row-card'));
    const idx = rowCards.indexOf(active);

    if (e.key === 'ArrowRight') {
      if (idx + 1 < rowCards.length) focusAndCenter(rowCards[idx + 1]);
    } else if (e.key === 'ArrowLeft') {
      if (idx > 0) focusAndCenter(rowCards[idx - 1]);
    } else if (e.key === 'ArrowDown') {
      // Saltar a la siguiente fila
      const allRowScrolls = Array.from(document.querySelectorAll('.row-scroll'));
      const rowIdx = allRowScrolls.indexOf(parentRow);
      if (rowIdx + 1 < allRowScrolls.length) {
        const nextRow = allRowScrolls[rowIdx + 1];
        const firstCard = nextRow.querySelector('.row-card');
        if (firstCard) focusAndCenter(firstCard);
      } else {
        // Última fila: ir al botón "Ver Todas las Categorías"
        if (dom.exploreAllBtn) focusAndCenter(dom.exploreAllBtn);
      }
    } else if (e.key === 'ArrowUp') {
      // Saltar a la fila anterior
      const allRowScrolls = Array.from(document.querySelectorAll('.row-scroll'));
      const rowIdx = allRowScrolls.indexOf(parentRow);
      if (rowIdx > 0) {
        const prevRow = allRowScrolls[rowIdx - 1];
        const firstCard = prevRow.querySelector('.row-card');
        if (firstCard) focusAndCenter(firstCard);
      } else {
        // Primera fila: ir al Hero Banner
        focusAndCenter(dom.heroPlayBtn);
      }
    }
    return;
  }

  // 4.B NAVEGACIÓN EN EL BOTÓN "VER TODAS LAS CATEGORÍAS"
  if (active === dom.exploreAllBtn) {
    e.preventDefault();
    if (e.key === 'ArrowUp') {
      const allRowScrolls = Array.from(document.querySelectorAll('.row-scroll'));
      if (allRowScrolls.length > 0) {
        const lastRow = allRowScrolls[allRowScrolls.length - 1];
        const firstCard = lastRow.querySelector('.row-card');
        if (firstCard) focusAndCenter(firstCard);
      }
    }
    return;
  }

  // 4.C NAVEGACIÓN EN BOTONES DE GÉNERO (EXPLORADOR)
  if (active && active.classList.contains('genre-filter-btn')) {
    e.preventDefault();
    const genreBtns = Array.from(dom.genreBtnGrid.querySelectorAll('.genre-filter-btn'));
    const gIdx = genreBtns.indexOf(active);
    if (e.key === 'ArrowRight') {
      if (gIdx + 1 < genreBtns.length) focusAndCenter(genreBtns[gIdx + 1]);
    } else if (e.key === 'ArrowLeft') {
      if (gIdx > 0) focusAndCenter(genreBtns[gIdx - 1]);
    } else if (e.key === 'ArrowDown') {
      // Ir a la grilla del explorador
      const firstExploreCard = dom.exploreGrid ? dom.exploreGrid.querySelector('.media-card') : null;
      if (firstExploreCard) focusAndCenter(firstExploreCard);
    } else if (e.key === 'ArrowUp') {
      if (dom.explorerBackBtn) focusAndCenter(dom.explorerBackBtn);
    }
    return;
  }

  // 4.D NAVEGACIÓN EN LA GRILLA DEL EXPLORADOR
  if (dom.exploreGrid && dom.exploreGrid.contains(active) && active.classList.contains('media-card')) {
    e.preventDefault();
    const exploreCards = Array.from(dom.exploreGrid.querySelectorAll('.media-card'));
    const eIdx = exploreCards.indexOf(active);
    const eCols = getGridColumnsCount();
    if (e.key === 'ArrowRight') {
      if (eIdx + 1 < exploreCards.length) focusAndCenter(exploreCards[eIdx + 1]);
    } else if (e.key === 'ArrowLeft') {
      if (eIdx > 0) focusAndCenter(exploreCards[eIdx - 1]);
    } else if (e.key === 'ArrowDown') {
      if (eIdx + eCols < exploreCards.length) focusAndCenter(exploreCards[eIdx + eCols]);
      else if (dom.exploreLoadMoreBtn && !dom.exploreLoadMoreBtn.classList.contains('hidden')) focusAndCenter(dom.exploreLoadMoreBtn);
    } else if (e.key === 'ArrowUp') {
      if (eIdx - eCols >= 0) focusAndCenter(exploreCards[eIdx - eCols]);
      else {
        const firstGenreBtn = dom.genreBtnGrid ? dom.genreBtnGrid.querySelector('.genre-filter-btn') : null;
        if (firstGenreBtn) focusAndCenter(firstGenreBtn);
      }
    }
    return;
  }

  // 4.E NAVEGACIÓN EN LA GRILLA DE CATÁLOGO (SERIES, ANIME, CARTOONS, BÚSQUEDA)
  const cards = Array.from(document.querySelectorAll('#catalog-section .media-card, #catalog-section .live-channel-card'));
  const cardIndex = cards.indexOf(active);

  // A. Si estamos navegando en la grilla de tarjetas
  if (cardIndex !== -1) {
    e.preventDefault();
    const cols = getGridColumnsCount();

    if (e.key === 'ArrowRight') {
      if (cardIndex + 1 < cards.length) {
        focusAndCenter(cards[cardIndex + 1]);
      }
    } else if (e.key === 'ArrowLeft') {
      if (cardIndex > 0) {
        focusAndCenter(cards[cardIndex - 1]);
      }
    } else if (e.key === 'ArrowDown') {
      if (cardIndex + cols < cards.length) {
        focusAndCenter(cards[cardIndex + cols]);
      } else if (!dom.loadMoreBtn.classList.contains('hidden')) {
        focusAndCenter(dom.loadMoreBtn);
      }
    } else if (e.key === 'ArrowUp') {
      if (cardIndex - cols >= 0) {
        focusAndCenter(cards[cardIndex - cols]);
      } else {
        // Subir al Hero Banner
        focusAndCenter(dom.heroPlayBtn);
      }
    }
    return;
  }

  // B.0 Si estamos en la Barra de Pestañas (Sub-Navbar)
  const navTabs = Array.from(dom.navTabButtons || []);
  const tabIndex = navTabs.indexOf(active);

  if (tabIndex !== -1) {
    e.preventDefault();
    if (e.key === 'ArrowRight') {
      const next = navTabs[tabIndex + 1] || navTabs[0];
      focusAndCenter(next);
    } else if (e.key === 'ArrowLeft') {
      const prev = navTabs[tabIndex - 1] || navTabs[navTabs.length - 1];
      focusAndCenter(prev);
    } else if (e.key === 'ArrowUp') {
      focusAndCenter(dom.brandLogo || dom.headerSearchBtn);
    } else if (e.key === 'ArrowDown') {
      if (dom.heroPlayBtn && dom.heroPlayBtn.offsetParent !== null) {
        focusAndCenter(dom.heroPlayBtn);
      } else if (cards.length > 0) {
        focusAndCenter(cards[0]);
      }
    }
    return;
  }

  // B. Si estamos en el Hero Banner
  if (active === dom.heroPlayBtn) {
    e.preventDefault();
    if (e.key === 'ArrowRight') focusAndCenter(dom.heroInfoBtn);
    else if (e.key === 'ArrowDown') {
      // En layout Netflix → ir a la primera fila
      const firstRowCard = dom.homeRowsContainer && !dom.homeRowsContainer.classList.contains('hidden')
        ? document.querySelector('.row-scroll .row-card')
        : null;
      if (firstRowCard) focusAndCenter(firstRowCard);
      else if (cards.length > 0) focusAndCenter(cards[0]);
    }
    else if (e.key === 'ArrowUp') {
      const activeTab = document.querySelector('.nav-tab-btn.active') || (dom.navTabButtons && dom.navTabButtons[0]);
      focusAndCenter(activeTab || dom.headerSearchBtn);
    }
    return;
  }

  if (active === dom.heroInfoBtn) {
    e.preventDefault();
    if (e.key === 'ArrowLeft') focusAndCenter(dom.heroPlayBtn);
    else if (e.key === 'ArrowDown') {
      const firstRowCard = dom.homeRowsContainer && !dom.homeRowsContainer.classList.contains('hidden')
        ? document.querySelector('.row-scroll .row-card')
        : null;
      if (firstRowCard) focusAndCenter(firstRowCard);
      else if (cards.length > 0) focusAndCenter(cards[0]);
    }
    else if (e.key === 'ArrowUp') {
      const activeTab = document.querySelector('.nav-tab-btn.active') || (dom.navTabButtons && dom.navTabButtons[0]);
      focusAndCenter(activeTab || dom.headerSearchBtn);
    }
    return;
  }

  // C. Si estamos en el Header
  if (active === dom.sidebarToggleBtn) {
    e.preventDefault();
    if (e.key === 'ArrowLeft') focusAndCenter(dom.headerSearchBtn || dom.brandLogo);
    else if (e.key === 'ArrowDown') {
      const activeTab = document.querySelector('.nav-tab-btn.active') || (dom.navTabButtons && dom.navTabButtons[0]);
      focusAndCenter(activeTab || dom.heroPlayBtn);
    }
    return;
  }

  if (active === dom.headerSearchBtn) {
    e.preventDefault();
    if (e.key === 'ArrowLeft') focusAndCenter(dom.brandLogo);
    else if (e.key === 'ArrowRight') focusAndCenter(dom.sidebarToggleBtn);
    else if (e.key === 'ArrowDown') {
      const activeTab = document.querySelector('.nav-tab-btn.active') || (dom.navTabButtons && dom.navTabButtons[0]);
      focusAndCenter(activeTab || dom.heroPlayBtn);
    }
    return;
  }

  if (active === dom.brandLogo) {
    e.preventDefault();
    if (e.key === 'ArrowRight') focusAndCenter(dom.headerSearchBtn || dom.sidebarToggleBtn);
    else if (e.key === 'ArrowDown') {
      const activeTab = document.querySelector('.nav-tab-btn.active') || (dom.navTabButtons && dom.navTabButtons[0]);
      focusAndCenter(activeTab || dom.heroPlayBtn);
    }
    return;
  }

  // D. Si estamos en el botón Cargar Más
  if (active === dom.loadMoreBtn) {
    if (e.key === 'ArrowUp' && cards.length > 0) {
      e.preventDefault();
      focusAndCenter(cards[cards.length - 1]);
    }
    return;
  }

  // E. Foco inicial por defecto si no hay nada enfocado
  if (cards.length > 0) {
    focusAndCenter(dom.heroPlayBtn);
  }
}

// ============================================================================
// 12. EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // Motor D-Pad para teclado y controles remotos Smart TV
  window.addEventListener('keydown', handleDpadNavigation);

  // Apertura y Cierre del Menú Lateral (Click / Touch / Enter)
  dom.sidebarToggleBtn.addEventListener('click', toggleSidebar);
  dom.sidebarEdgeTab.addEventListener('click', toggleSidebar);
  dom.sidebarCloseBtn.addEventListener('click', closeSidebar);
  dom.sidebarOverlay.addEventListener('click', closeSidebar);

  // Clic en logo -> Cargar películas (Categoría Principal)
  dom.brandLogo.addEventListener('click', (e) => {
    e.preventDefault();
    loadActiveTab('movie', 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Pestañas de Navegación Sub-Navbar (Películas, Series, Anime, Dibujos Animados)
  dom.navTabButtons = document.querySelectorAll('.nav-tab-btn');
  dom.navTabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      loadActiveTab(btn.dataset.category, 1);
    });
  });

  // Acceso al Buscador desde el Menú Lateral
  if (dom.sidebarSearchBtn) {
    dom.sidebarSearchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeSidebar();
      openSearchModal();
    });
  }

  // Modal de Búsqueda Dedicado (Acceso Header y Cierre)
  if (dom.headerSearchBtn) {
    dom.headerSearchBtn.addEventListener('click', openSearchModal);
  }

  if (dom.searchModalCloseBtn) {
    dom.searchModalCloseBtn.addEventListener('click', closeSearchModal);
  }

  if (dom.searchModal) {
    dom.searchModal.addEventListener('click', (e) => {
      if (e.target === dom.searchModal) closeSearchModal();
    });
  }

  // Buscador dentro del modal con debounce
  const debouncedModalSearch = debounce((q) => performModalSearch(q), 350);

  if (dom.modalSearchInput) {
    dom.modalSearchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (dom.modalClearSearchBtn) {
        dom.modalClearSearchBtn.classList.toggle('hidden', val.length === 0);
      }
      debouncedModalSearch(val);
    });

    dom.modalSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstCard = dom.searchResultsGrid.querySelector('.media-card');
        if (firstCard) {
          focusAndCenter(firstCard);
        } else {
          performModalSearch(dom.modalSearchInput.value);
        }
      }
    });
  }

  if (dom.modalClearSearchBtn) {
    dom.modalClearSearchBtn.addEventListener('click', () => {
      dom.modalSearchInput.value = '';
      dom.modalClearSearchBtn.classList.add('hidden');
      renderSearchInitialState();
      dom.modalSearchInput.focus();
    });
  }

  // Botón Cargar Más
  dom.loadMoreBtn.addEventListener('click', () => {
    if (state.currentPage < state.totalPages) {
      loadActiveTab(state.currentTab, state.currentPage + 1);
    }
  });

  // Botón "Ver Todas las Categorías" → Explorador
  if (dom.exploreAllBtn) {
    dom.exploreAllBtn.addEventListener('click', () => {
      showCategoryExplorer();
    });
  }

  // Botón "Volver al Inicio" del Explorador
  if (dom.explorerBackBtn) {
    dom.explorerBackBtn.addEventListener('click', () => {
      hideCategoryExplorer();
    });
  }

  // Botón "Cargar Más" del Explorador de Categorías
  if (dom.exploreLoadMoreBtn) {
    dom.exploreLoadMoreBtn.addEventListener('click', () => {
      if (state.explorer.activeGenreId && state.explorer.currentPage < state.explorer.totalPages) {
        const activeBtn = dom.genreBtnGrid.querySelector('.genre-filter-btn.active');
        const genreName = activeBtn ? activeBtn.textContent.trim() : '';
        loadGenreResults(state.explorer.activeGenreId, genreName, state.explorer.currentPage + 1);
      }
    });
  }

  // Guardar y Borrar API Key
  dom.saveApiKeyBtn.addEventListener('click', () => {
    const key = dom.apiKeyInput.value.trim();
    if (key) {
      localStorage.setItem('pelisflix_tmdb_api_key', key);
      updateApiKeyStatus();
      showToast('¡API Key guardada en PelisFlix!');
      loadActiveTab(state.currentTab, 1);
    } else {
      showToast('Ingresa una API Key válida');
    }
  });

  dom.clearApiKeyBtn.addEventListener('click', () => {
    localStorage.removeItem('pelisflix_tmdb_api_key');
    updateApiKeyStatus();
    showToast('API Key eliminada. Modo demo activo.');
    loadActiveTab(state.currentTab, 1);
  });

  // Selector de Servidores en el Reproductor
  if (dom.serverSelect) {
    dom.serverSelect.addEventListener('change', (e) => {
      handleServerChange(e.target.value);
    });
  }

  // Botón para cambiar rápidamente al siguiente servidor
  if (dom.quickSwitchServerBtn) {
    dom.quickSwitchServerBtn.addEventListener('click', () => {
      cycleNextServer();
    });
  }

  // Botón del buscador en el menú lateral
  if (dom.sidebarSearchBtn) {
    dom.sidebarSearchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeSidebar();
      openSearchModal();
    });
  }

  // Botón Volver a detalles
  dom.playerCloseViewBtn.addEventListener('click', () => {
    stopAndClearPlayer();
  });

  // Botones del Hero Banner
  dom.heroPlayBtn.addEventListener('click', () => {
    if (state.featuredHeroItem) {
      state.lastFocusedElementBeforeModal = dom.heroPlayBtn;
      if (state.currentTab === 'live' || state.featuredHeroItem.isLiveChannel) {
        openLiveChannel(state.featuredHeroItem);
        return;
      }
      const isMovie = state.featuredHeroItem.media_type === 'movie' || (!state.featuredHeroItem.media_type && state.featuredHeroItem.title);
      openMediaModal(state.featuredHeroItem.id, isMovie ? 'movie' : 'tv', true);
    }
  });

  dom.heroInfoBtn.addEventListener('click', () => {
    if (state.featuredHeroItem) {
      state.lastFocusedElementBeforeModal = dom.heroInfoBtn;
      if (state.currentTab === 'live' || state.featuredHeroItem.isLiveChannel) {
        openLiveChannel(state.featuredHeroItem);
        return;
      }
      const isMovie = state.featuredHeroItem.media_type === 'movie' || (!state.featuredHeroItem.media_type && state.featuredHeroItem.title);
      openMediaModal(state.featuredHeroItem.id, isMovie ? 'movie' : 'tv', false);
    }
  });

  // Botón Reproducir Ahora en el modal
  dom.modalPlayBtn.addEventListener('click', () => {
    if (state.activeItemDetails) {
      const isMovie = state.activeItemDetails.media_type === 'movie';
      const title = dom.modalTitle.textContent;
      if (isMovie) {
        startPlayback({ type: 'movie', id: state.activeItemDetails.id, title: `Película: ${title}` });
      } else {
        startPlayback({
          type: 'tv',
          id: state.activeItemDetails.id,
          season: state.activeSeason || 1,
          episode: 1,
          title: `${title} - Temporada ${state.activeSeason || 1} Episodio 1`
        });
      }
    }
  });

  // Cerrar Modal
  dom.modalCloseBtn.addEventListener('click', closeMediaModal);

  dom.mediaModal.addEventListener('click', (e) => {
    if (e.target === dom.mediaModal) closeMediaModal();
  });

  // Configuración y Autenticación con PIN
  if (dom.configMenuBtn) {
    dom.configMenuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openPinModal();
    });
  }

  if (dom.pinCloseBtn) dom.pinCloseBtn.addEventListener('click', closePinModal);
  if (dom.pinCancelBtn) dom.pinCancelBtn.addEventListener('click', closePinModal);

  if (dom.pinForm) {
    dom.pinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      verifyPin();
    });
  }

  if (dom.pinSubmitBtn) {
    dom.pinSubmitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      verifyPin();
    });
  }

  if (dom.pinInput) {
    dom.pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        verifyPin();
      }
    });
  }

  if (dom.pinModal) {
    dom.pinModal.addEventListener('click', (e) => {
      if (e.target === dom.pinModal) closePinModal();
    });
  }

  if (dom.settingsCloseBtn) {
    dom.settingsCloseBtn.addEventListener('click', closeSettingsModal);
  }

  if (dom.settingsModal) {
    dom.settingsModal.addEventListener('click', (e) => {
      if (e.target === dom.settingsModal) closeSettingsModal();
    });
  }

  // ============================================================================
  // Scroll Dinámico del Header (Smart Sticky Navbar con Auto-hide on Scroll Down)
  // ============================================================================
  let lastScrollY = Math.max(0, window.scrollY || 0);
  const scrollCompactThreshold = 50;  // Umbral para transición a modo compacto
  const scrollHideThreshold = 120;     // Distancia mínima antes de permitir auto-ocultamiento
  const scrollDeltaThreshold = 6;      // Tolerancia mínima para filtrar micro-scrolls

  const handleHeaderScroll = () => {
    const currentScrollY = Math.max(0, window.scrollY || 0);
    const deltaY = currentScrollY - lastScrollY;

    // 1. Estado inicial al tope de la página
    if (currentScrollY <= 15) {
      if (dom.header) {
        dom.header.classList.remove('header-scrolled', 'scrolled', 'header-hidden');
      }
      document.body.classList.remove('header-scrolled', 'header-hidden');
      lastScrollY = currentScrollY;
      return;
    }

    // 2. Estado compacto: activa cuando supera el umbral de inicio de scroll
    const isCompact = currentScrollY > scrollCompactThreshold;
    if (dom.header) {
      dom.header.classList.toggle('header-scrolled', isCompact);
      dom.header.classList.toggle('scrolled', isCompact);
    }
    document.body.classList.toggle('header-scrolled', isCompact);

    // 3. Ocultamiento inteligente por dirección de scroll (Auto-hide on Scroll Down)
    if (isCompact && currentScrollY > scrollHideThreshold) {
      if (deltaY > scrollDeltaThreshold) {
        // Desplazamiento hacia abajo (Scroll Down): ocultar Header hacia arriba
        if (dom.header) dom.header.classList.add('header-hidden');
        document.body.classList.add('header-hidden');
      } else if (deltaY < -scrollDeltaThreshold) {
        // Desplazamiento hacia arriba (Scroll Up): mostrar Header compacto de inmediato
        if (dom.header) dom.header.classList.remove('header-hidden');
        document.body.classList.remove('header-hidden');
      }
    } else {
      // Cerca del tope: mantener siempre visible
      if (dom.header) dom.header.classList.remove('header-hidden');
      document.body.classList.remove('header-hidden');
    }

    lastScrollY = currentScrollY;
  };

  window.addEventListener('scroll', handleHeaderScroll, { passive: true });
  handleHeaderScroll();

  // Accesibilidad Smart TV / Teclado: Si cualquier elemento dentro del Header recibe foco, mostrar el navbar
  if (dom.header) {
    dom.header.addEventListener('focusin', () => {
      dom.header.classList.remove('header-hidden');
      document.body.classList.remove('header-hidden');
    });
  }

  // Sincronización al salir de pantalla completa de forma nativa (teclado / control remoto)
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && !dom.modalPlayerSection.classList.contains('hidden')) {
      focusAndCenter(dom.serverSelect);
    }
  });

  document.addEventListener('webkitfullscreenchange', () => {
    if (!document.webkitFullscreenElement && !dom.modalPlayerSection.classList.contains('hidden')) {
      focusAndCenter(dom.serverSelect);
    }
  });

  // Reaparición inmediata de la barra de controles al interactuar (Mouse, Touch, Teclado/TV)
  const handlePlayerUserActivity = () => {
    if (isPlayerActive()) {
      resetPlayerControlsTimer();
    }
  };

  window.addEventListener('mousemove', handlePlayerUserActivity, { passive: true });
  window.addEventListener('touchstart', handlePlayerUserActivity, { passive: true });
  window.addEventListener('keydown', handlePlayerUserActivity, { passive: true });

  if (dom.modalPlayerSection) {
    dom.modalPlayerSection.addEventListener('mousemove', handlePlayerUserActivity, { passive: true });
    dom.modalPlayerSection.addEventListener('touchstart', handlePlayerUserActivity, { passive: true });
    dom.modalPlayerSection.addEventListener('click', handlePlayerUserActivity);
  }

  if (dom.playerTopBar) {
    dom.playerTopBar.addEventListener('focusin', () => {
      showPlayerControls();
      if (playerControlsTimer) {
        clearTimeout(playerControlsTimer);
        playerControlsTimer = null;
      }
    });

    dom.playerTopBar.addEventListener('focusout', () => {
      if (isPlayerActive()) {
        resetPlayerControlsTimer();
      }
    });
  }
}

// ============================================================================
// 13. INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  updateApiKeyStatus();
  setupEventListeners();
  loadActiveTab('movie', 1);

  // Dar foco inicial amigable para Smart TV tras carga
  setTimeout(() => {
    const activeTab = document.querySelector('.nav-tab-btn.active') || dom.heroPlayBtn;
    if (activeTab) activeTab.focus();
  }, 350);
});
