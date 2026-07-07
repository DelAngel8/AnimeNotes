// --- UTILIDADES DE SEGURIDAD ---
function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Escape a URL for use inside CSS url('...') — escapes single quotes and backslashes
function escapeCSSUrl(url) {
    if (url == null) return '';
    return String(url).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Debounce utility — delays function execution until after `delay` ms of inactivity
function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// --- ALMACENAMIENTO Y ESTADO ---
const STORAGE_KEY = 'animenotes_data';
const MIGRATION_KEY = 'animenotes_demo_migrated';

// Datos de demostración para la primera vez
const now = Date.now();
const demoData = [
    {
        id: "demo_kimi_wo",
        title: "Kimi wo Aishita Hitori no Boku e",
        image: "https://cdn.myanimelist.net/images/anime/1332/127596l.jpg",
        type: "Película",
        studio: "TMS Entertainment",
        status: "Finalizado",
        genres: ["Romance", "Sci-Fi"],
        rating: 7.8,
        synopsis: "Tras el divorcio de sus padres, Koyomi de siete años decide vivir con su padre investigador de mundos paralelos. Pronto conoce a Shiori, la hija de otro investigador, y con el tiempo prometen casarse, pero todo cambia cuando sus padres deciden casarse entre ellos.",
        review: "Una historia muy interesante sobre mundos paralelos. Complementa a la otra película mostrando una línea temporal diferente.",
        updatedAt: now - 1000,
        category: "anime"
    },
    {
        id: "demo_boku_ga",
        title: "Boku ga Aishita Subete no Kimi e",
        image: "https://cdn.myanimelist.net/images/anime/1145/127594l.jpg",
        type: "Película",
        studio: "Bakken Record",
        status: "Finalizado",
        genres: ["Romance", "Sci-Fi"],
        rating: 7.8,
        synopsis: "En un mundo donde la gente salta habitualmente entre mundos paralelos con pequeñas diferencias, Koyomi Takasaki es abordado por Kazune Takigawa, quien le revela que viene del mundo 85 donde ellos dos son amantes.",
        review: "Increíble cómo se entrelaza con la otra película. Dependiendo del orden en el que las veas la perspectiva cambia totalmente.",
        updatedAt: now - 2000,
        category: "anime"
    }
];

// Mapa de géneros inglés → español (para normalizar datos externos de APIs)
const GENRE_MAP = {
    'Action':        'Acción',
    'Adventure':     'Aventura',
    'Comedy':        'Comedia',
    'Drama':         'Drama',
    'Fantasy':       'Fantasía',
    'Horror':        'Terror',
    'Mystery':       'Misterio',
    'Romance':       'Romance',
    'Sci-Fi':        'Sci-Fi',
    'Science Fiction': 'Sci-Fi',
    'Slice of Life': 'Slice of Life',
    'Sports':        'Deportes',
    'Supernatural':  'Sobrenatural',
    'Thriller':      'Thriller',
    'Ecchi':         'Ecchi',
    'Mecha':         'Mecha',
    'Music':         'Música',
    'Psychological': 'Psicológico',
    'Historical':    'Histórico',
    'School':        'Escolar',
    'Shounen':       'Shounen',
    'Shoujo':        'Shoujo',
    'Seinen':        'Seinen',
};

// Normaliza un género al español; si ya está en español o no está en el mapa, lo devuelve tal cual
function normalizeGenre(genre) {
    return GENRE_MAP[genre] || genre;
}

// Ensure every anime has required fields (defensive normalization for malformed/legacy data)
function ensureGenres(anime) {
    if (!Array.isArray(anime.genres)) anime.genres = [];
    // Backwards compatibility: items without category are anime
    if (!anime.category) anime.category = 'anime';
    return anime;
}

// Get subtitle text based on category (studio for anime, director/network for general)
function getSubtitle(anime) {
    const cat = anime.category || 'anime';
    if (cat === 'general') {
        const isMovie = anime.type === 'Película';
        const parts = [];
        if (anime.director) parts.push(anime.director);
        if (anime.network) parts.push(anime.network);
        if (!isMovie && anime.seasons) parts.push(`${anime.seasons} temp`);
        return parts.join(' · ') || '';
    }
    return anime.studio || '';
}

// Get the info badge text based on category
function getInfoBadge(anime) {
    const cat = anime.category || 'anime';
    if (cat === 'general') {
        const parts = [];
        if (anime.director) parts.push(anime.director);
        if (anime.network) parts.push(anime.network);
        return parts.join(' · ');
    }
    return anime.studio || '';
}

let animes = [];
let filteredAnimes = [];
let currentEditingId = null;
let currentDetailId = null;
let currentGenreFilter = 'all';
let currentTypeFilter = 'all';
let currentSortFilter = 'default';
let currentCategoryFilter = 'all'; // 'all' | 'anime' | 'general'
let heroInterval = null;
let currentHeroIndex = 0;
let isPendingView = false;

// Un anime es "pendiente" si no tiene rating o su rating es 0
function isPending(anime) {
    return !anime.rating || parseFloat(anime.rating) === 0;
}

// --- CUSTOM DROPDOWNS ---
function toggleDropdown(menuId) {
    const menu = document.getElementById(menuId);
    if (menu.classList.contains('hidden')) {
        // Cierra otros menus
        ['genreMenu', 'sortMenu', 'typeMenu'].forEach(id => {
            const m = document.getElementById(id);
            if (m) {
                m.classList.add('hidden');
                m.classList.remove('flex');
                // Update aria-expanded on trigger button
                const container = m.closest('.relative');
                if (container) {
                    const trigger = container.querySelector('button');
                    if (trigger) trigger.setAttribute('aria-expanded', 'false');
                }
            }
        });
        menu.classList.remove('hidden');
        menu.classList.add('flex');
        // Update aria-expanded on trigger button
        const container = menu.closest('.relative');
        if (container) {
            const trigger = container.querySelector('button');
            if (trigger) trigger.setAttribute('aria-expanded', 'true');
        }
    } else {
        menu.classList.add('hidden');
        menu.classList.remove('flex');
        // Update aria-expanded on trigger button
        const container = menu.closest('.relative');
        if (container) {
            const trigger = container.querySelector('button');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        }
    }
}

function closeAllDropdowns() {
    ['genreMenu', 'sortMenu', 'typeMenu'].forEach(id => {
        const m = document.getElementById(id);
        if (m) {
            m.classList.add('hidden');
            m.classList.remove('flex');
            const container = m.closest('.relative');
            if (container) {
                const trigger = container.querySelector('button');
                if (trigger) trigger.setAttribute('aria-expanded', 'false');
            }
        }
    });
}

function selectFilter(filterType, value, label) {
    if (filterType === 'genre') {
        currentGenreFilter = value;
        document.getElementById('genreSelectedText').textContent = label;
    } else if (filterType === 'type') {
        currentTypeFilter = value;
        document.getElementById('typeSelectedText').textContent = label;
    } else if (filterType === 'sort') {
        currentSortFilter = value;
        document.getElementById('sortSelectedText').textContent = label;
    }
    closeAllDropdowns();
    
    // Resetear el hero index al filtrar
    currentHeroIndex = 0;
    if (isPendingView) {
        renderPending();
    } else {
        renderApp();
    }
}

function selectCategory(category) {
    currentCategoryFilter = category;
    // Update active tab styling
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.category === category) {
            tab.classList.add('active');
        }
    });
    currentHeroIndex = 0;
    if (isPendingView) {
        renderPending();
    } else {
        renderApp();
    }
}

// --- INICIALIZACIÓN ---
async function init() {
    setupEventListeners();
    await loadData();
    buildFilterMenus();
    renderApp();
}

// --- LÓGICA DE DATOS (CRUD) ---
async function loadData() {
    try {
        const response = await fetch('/api/data');
        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                animes = data.map(ensureGenres);
                // One-time migration: replace old demo entries with current demo data
                if (!localStorage.getItem(MIGRATION_KEY) && animes.some(a => a.id === "demo_1" || a.id === "demo_10")) {
                    animes = [...demoData].map(ensureGenres);
                    await saveData();
                    localStorage.setItem(MIGRATION_KEY, '1');
                }
            } else {
                animes = [...demoData].map(ensureGenres);
                await saveData();
            }
            return; // Salimos de la función si el servidor respondió bien
        }
    } catch (e) {
        console.log("Servidor local no detectado. Usando modo Offline (LocalStorage).");
    }

    // Fallback si abres el index.html con doble clic sin el servidor
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            animes = JSON.parse(data).map(ensureGenres);
            // One-time migration: replace old demo entries with current demo data
            if (!localStorage.getItem(MIGRATION_KEY) && animes.some(a => a.id === "demo_1" || a.id === "demo_10")) {
                animes = [...demoData].map(ensureGenres);
                await saveData();
                localStorage.setItem(MIGRATION_KEY, '1');
            }
        } else {
            animes = [...demoData].map(ensureGenres);
            await saveData();
        }
    } catch (e) {
        console.warn("localStorage corrupto. Limpiando y usando datos de demo.", e);
        localStorage.removeItem(STORAGE_KEY);
        animes = [...demoData].map(ensureGenres);
        await saveData();
    }
}

async function saveData() {
    try {
        const response = await fetch('/api/data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(animes)
        });
        if (response.ok) {
            return; // Guardado exitoso en el archivo local datos.json
        }
    } catch (e) {
        // Ignorar si falla la red, guardará abajo en localStorage
    }
    
    // Fallback a memoria local
    localStorage.setItem(STORAGE_KEY, JSON.stringify(animes));
}

function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

async function saveAnime(animeData) {
    // Normalizar rating: si está vacío o es 0, queda como pendiente
    const ratingVal = animeData.rating;
    const normalizedRating = (ratingVal === '' || ratingVal === null || ratingVal === undefined || isNaN(ratingVal))
        ? 0
        : parseFloat(ratingVal);
    const normalizedData = { ...animeData, rating: normalizedRating };

    if (currentEditingId) {
        // Actualizar
        const index = animes.findIndex(a => a.id === currentEditingId);
        if (index !== -1) {
            animes[index] = { ...animes[index], ...normalizedData, updatedAt: Date.now() };
        }
    } else {
        // Crear
        animes.unshift({ ...normalizedData, id: generateId(), updatedAt: Date.now() });
    }
    await saveData();
    closeModal('formModal');
    buildFilterMenus();

    // Si el anime ahora tiene nota y estábamos en pendientes, volver al catálogo
    if (isPendingView && normalizedRating > 0) {
        closePendingView();
    } else if (isPendingView) {
        renderPending();
        updatePendingCount();
    } else {
        renderApp();
    }
}

async function deleteAnime(id) {
    if (confirm('¿Estás seguro de que quieres borrar este anime?')) {
        animes = animes.filter(a => a.id !== id);
        await saveData();
        closeModal('detailsModal');
        if (isPendingView) {
            renderPending();
            updatePendingCount();
        } else {
            renderApp();
        }
    }
}

// --- SISTEMA DE CALIFICACIONES ---
function getRatingInfo(rating) {
    const num = parseFloat(rating);
    if (num === 10) return { text: "Obra maestra", icon: '<i class="fa-solid fa-crown text-yellow-400"></i>' };
    if (num >= 9 && num <= 9.9) return { text: "Legendaria", icon: '<i class="fa-solid fa-star text-yellow-300"></i>' };
    if (num >= 8 && num <= 8.9) return { text: "Excelente", icon: '<i class="fa-solid fa-fire text-orange-500"></i>' };
    if (num >= 7 && num <= 7.9) return { text: "Muy buena", icon: '<i class="fa-solid fa-thumbs-up text-green-400"></i>' };
    if (num >= 6 && num <= 6.9) return { text: "Buena", icon: '<i class="fa-solid fa-face-smile text-green-300"></i>' };
    if (num >= 5 && num <= 5.9) return { text: "Regular", icon: '<i class="fa-solid fa-face-meh text-gray-400"></i>' };
    return { text: "Mala", icon: '<i class="fa-solid fa-thumbs-down text-red-500"></i>' };
}

function updateRatingPreview() {
    const ratingInput = document.getElementById('rating').value;
    const previewEl = document.getElementById('ratingPreview');
    if (ratingInput !== '') {
        const info = getRatingInfo(ratingInput);
        previewEl.innerHTML = `${info.text} ${info.icon}`;
        
        // Asignar color dinámico en el preview
        if(ratingInput == 10) previewEl.className = "text-sm font-bold text-yellow-400";
        else if(ratingInput >= 8) previewEl.className = "text-sm font-bold text-brand-400";
        else if(ratingInput >= 6) previewEl.className = "text-sm font-bold text-green-400";
        else previewEl.className = "text-sm font-bold text-red-400";
    } else {
        previewEl.innerHTML = '';
    }
}

// --- VISTA PENDIENTES ---
function openPendingView() {
    isPendingView = true;
    // Cancelar el intervalo del hero para que no lo reactive después de ocultarlo
    if (heroInterval) {
        clearInterval(heroInterval);
        heroInterval = null;
    }
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('catalogContainer').classList.add('hidden');
    document.getElementById('pendingView').classList.remove('hidden');
    document.getElementById('pendingBtn').classList.add('border-[#82aaff]', 'text-white');
    renderPending();
}

function closePendingView() {
    isPendingView = false;
    document.getElementById('pendingView').classList.add('hidden');
    document.getElementById('catalogContainer').classList.remove('hidden');
    document.getElementById('pendingBtn').classList.remove('border-[#82aaff]', 'text-white');
    renderApp();
}

function updatePendingCount() {
    const count = animes.filter(isPending).length;
    const badge = document.getElementById('pendingCount');
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.remove('hidden');
        badge.classList.add('flex');
    } else {
        badge.classList.add('hidden');
        badge.classList.remove('flex');
    }
}

function renderPending() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const pendingAnimes = animes
        .filter(isPending)
        .filter(anime => {
            const matchSearch = !search ||
                anime.title.toLowerCase().includes(search) ||
                (anime.genres || []).join(' ').toLowerCase().includes(search) ||
                (anime.studio && anime.studio.toLowerCase().includes(search)) ||
                (anime.director && anime.director.toLowerCase().includes(search)) ||
                (anime.network && anime.network.toLowerCase().includes(search));
            const matchType = currentTypeFilter === 'all' || anime.type === currentTypeFilter;
            const matchGenre = currentGenreFilter === 'all' ||
                ((anime.genres || []).map(normalizeGenre).includes(currentGenreFilter));
            const matchCategory = currentCategoryFilter === 'all' || (anime.category || 'anime') === currentCategoryFilter;
            return matchSearch && matchType && matchGenre && matchCategory;
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
    const grid = document.getElementById('pendingGrid');
    const emptyState = document.getElementById('pendingEmptyState');

    grid.innerHTML = '';

    if (pendingAnimes.length === 0) {
        grid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.classList.add('flex');
        return;
    }

    grid.classList.remove('hidden');
    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');

    pendingAnimes.forEach(anime => {
        const card = createPendingCard(anime);
        grid.appendChild(card);
    });
}

function createPendingCard(anime) {
    const card = document.createElement('div');
    card.className = 'anime-card aspect-[2/3] cursor-pointer shadow-lg';
    card.onclick = () => openDetailsModal(anime.id);

    card.innerHTML = `
        <div class="anime-card-inner absolute inset-0">
            <img src="${escapeAttr(anime.image)}" alt="${escapeAttr(anime.title)}" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27300%27 height=%27450%27 fill=%27%231a1a2e%27%3E%3Crect width=%27300%27 height=%27450%27/%3E%3Ctext x=%27150%27 y=%27225%27 font-family=%27sans-serif%27 font-size=%2714%27 fill=%27%23666%27 text-anchor=%27middle%27%3ESin imagen%3C/text%3E%3C/svg%3E'">
            <div class="absolute bottom-0 w-full h-2/3 bg-gradient-to-t from-black/90 to-transparent"></div>
            <!-- Badge "Pendiente" en lugar del tipo -->
            <div class="card-type-badge absolute top-2 right-2 bg-[#82aaff]/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded font-semibold border border-brand-400/40">
                <i class="fa-solid fa-clock mr-1"></i>${escapeHTML(anime.type)}
            </div>
            <div class="anime-card-overlay absolute inset-0 rounded-md p-4 flex flex-col justify-between">
                <!-- Top: tipo y estudio/director -->
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-white text-xs font-semibold bg-[#5472b3]/80 px-2 py-0.5 rounded">${escapeHTML(anime.type)}</span>
                    <span class="text-gray-300 text-xs bg-black/40 px-2 py-0.5 rounded">${escapeHTML(getInfoBadge(anime))}</span>
                </div>
                <!-- Bottom: info principal -->
                <div>
                    <h3 class="font-bold text-white text-base leading-tight line-clamp-2 mb-2">${escapeHTML(anime.title)}</h3>
                    <div class="flex items-center gap-2 mb-3 flex-wrap">
                        <span class="text-gray-400 text-xs font-semibold"><i class="fa-solid fa-clock mr-1 text-brand-400"></i>Sin calificar</span>
                        ${anime.episodes ? `<span class="text-gray-400 text-xs">· ${escapeHTML(anime.episodes)} eps</span>` : ''}
                    </div>
                    <button data-id="${escapeAttr(anime.id)}" onclick="event.stopPropagation(); openFormModal(this.dataset.id)" class="w-full py-2 rounded bg-[#5472b3] hover:bg-[#82aaff] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                        <i class="fa-solid fa-star"></i> Calificar
                    </button>
                </div>
            </div>
            <div class="card-footer absolute bottom-2 left-2 right-2 pointer-events-none">
                <h3 class="font-bold text-white text-sm line-clamp-1 drop-shadow-md">${escapeHTML(anime.title)}</h3>
                <div class="text-xs text-brand-400 font-bold drop-shadow-md"><i class="fa-solid fa-clock mr-1"></i>Pendiente</div>
            </div>
        </div>
    `;
    return card;
}

// --- FILTROS DINÁMICOS ---
function buildFilterMenus() {
    const btnClass = 'text-left px-4 py-2 text-gray-300 hover:bg-[#82aaff] hover:text-white transition-colors';
    const headerClass = 'text-xs font-bold text-gray-500 uppercase tracking-wider px-4 pt-3 pb-1';

    // --- Géneros: extraer todos los géneros únicos normalizados ---
    const animeGenres = new Set();
    const generalGenres = new Set();
    
    animes.forEach(a => {
        if (!a.genres) return;
        a.genres.forEach(g => {
            const normalized = normalizeGenre(g);
            if ((a.category || 'anime') === 'general') {
                generalGenres.add(normalized);
            } else {
                animeGenres.add(normalized);
            }
        });
    });

    // Merge all genres for the "all" view
    const allGenres = new Set([...animeGenres, ...generalGenres]);
    
    // Sort genres by frequency (most common first)
    const genreCount = {};
    animes.forEach(a => {
        if (!a.genres) return;
        a.genres.forEach(g => {
            const normalized = normalizeGenre(g);
            genreCount[normalized] = (genreCount[normalized] || 0) + 1;
        });
    });
    
    const sortedGenres = Array.from(allGenres).sort((a, b) => (genreCount[b] || 0) - (genreCount[a] || 0));
    const topGenres = sortedGenres.slice(0, 8);
    const remainingGenres = sortedGenres.slice(8);

    const genreMenu = document.getElementById('genreMenu');
    genreMenu.innerHTML = `<button class="${btnClass}" role="option" onclick="selectFilter('genre', 'all', 'Géneros')">Todos los géneros</button>`;
    
    // Top genres (always visible)
    topGenres.forEach(genre => {
        const label = genre.length > 12 ? genre.slice(0, 10) + '.' : genre;
        const btn = document.createElement('button');
        btn.className = btnClass;
        btn.setAttribute('role', 'option');
        btn.onclick = () => selectFilter('genre', genre, label);
        btn.textContent = genre;
        genreMenu.appendChild(btn);
    });

    // "Ver más" button if there are more than 8 genres
    if (remainingGenres.length > 0) {
        const expandBtn = document.createElement('button');
        expandBtn.id = 'genreExpandBtn';
        expandBtn.className = `${btnClass} text-[#7e57c2] font-semibold`;
        expandBtn.innerHTML = `<i class="fa-solid fa-plus mr-2 text-xs"></i>Ver todos (${allGenres.length})`;
        expandBtn.onclick = () => expandGenreMenu();
        genreMenu.appendChild(expandBtn);

        // Hidden container for remaining genres
        const extraContainer = document.createElement('div');
        extraContainer.id = 'genreExtraContainer';
        extraContainer.className = 'hidden flex-col';
        
        // Anime genres header (if any)
        const animeOnly = remainingGenres.filter(g => animeGenres.has(g) && !generalGenres.has(g));
        if (animeOnly.length > 0) {
            const header = document.createElement('div');
            header.className = headerClass;
            header.textContent = 'Anime';
            extraContainer.appendChild(header);
            animeOnly.forEach(genre => {
                const btn = document.createElement('button');
                btn.className = btnClass;
                btn.setAttribute('role', 'option');
                btn.onclick = () => selectFilter('genre', genre, genre);
                btn.textContent = genre;
                extraContainer.appendChild(btn);
            });
        }

        // General genres header (if any)
        const generalOnly = remainingGenres.filter(g => generalGenres.has(g) && !animeGenres.has(g));
        if (generalOnly.length > 0) {
            const header = document.createElement('div');
            header.className = headerClass;
            header.textContent = 'Películas / Series';
            extraContainer.appendChild(header);
            generalOnly.forEach(genre => {
                const btn = document.createElement('button');
                btn.className = btnClass;
                btn.setAttribute('role', 'option');
                btn.onclick = () => selectFilter('genre', genre, genre);
                btn.textContent = genre;
                extraContainer.appendChild(btn);
            });
        }

        // Shared genres in remaining
        const shared = remainingGenres.filter(g => animeGenres.has(g) && generalGenres.has(g));
        if (shared.length > 0) {
            const header = document.createElement('div');
            header.className = headerClass;
            header.textContent = 'Compartidos';
            extraContainer.appendChild(header);
            shared.forEach(genre => {
                const btn = document.createElement('button');
                btn.className = btnClass;
                btn.setAttribute('role', 'option');
                btn.onclick = () => selectFilter('genre', genre, genre);
                btn.textContent = genre;
                extraContainer.appendChild(btn);
            });
        }

        genreMenu.appendChild(extraContainer);
    }

    // --- Tipos: separar primarios (siempre visibles) vs secundarios (colapsados) ---
    const allTypes = new Set();
    animes.forEach(a => { if (a.type) allTypes.add(a.type); });

    const primaryTypes = ['Serie', 'Película'];
    const visibleTypes = primaryTypes.filter(t => allTypes.has(t));
    const secondaryTypes = Array.from(allTypes).filter(t => !primaryTypes.includes(t)).sort();

    const typeMenu = document.getElementById('typeMenu');
    typeMenu.innerHTML = `<button class="${btnClass}" role="option" onclick="selectFilter('type', 'all', 'Formatos')">Todos</button>`;

    visibleTypes.forEach(type => {
        const btn = document.createElement('button');
        btn.className = btnClass;
        btn.setAttribute('role', 'option');
        btn.onclick = () => selectFilter('type', type, type);
        btn.textContent = type;
        typeMenu.appendChild(btn);
    });

    if (secondaryTypes.length > 0) {
        const expandBtn = document.createElement('button');
        expandBtn.id = 'typeExpandBtn';
        expandBtn.className = `${btnClass} text-[#7e57c2] font-semibold`;
        expandBtn.innerHTML = `<i class="fa-solid fa-plus mr-2 text-xs"></i>Ver más (${secondaryTypes.length})`;
        expandBtn.onclick = () => expandTypeMenu();
        typeMenu.appendChild(expandBtn);

        const extraContainer = document.createElement('div');
        extraContainer.id = 'typeExtraContainer';
        extraContainer.className = 'hidden flex-col';

        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-gray-500 font-semibold';
        sectionHeader.textContent = 'Otros';
        extraContainer.appendChild(sectionHeader);

        secondaryTypes.forEach(type => {
            const btn = document.createElement('button');
            btn.className = btnClass;
            btn.setAttribute('role', 'option');
            btn.onclick = () => selectFilter('type', type, type);
            btn.textContent = type;
            extraContainer.appendChild(btn);
        });

        typeMenu.appendChild(extraContainer);
    }
}

function expandGenreMenu() {
    const extraContainer = document.getElementById('genreExtraContainer');
    const expandBtn = document.getElementById('genreExpandBtn');
    if (extraContainer && expandBtn) {
        extraContainer.classList.toggle('hidden');
        extraContainer.classList.toggle('flex');
        if (extraContainer.classList.contains('hidden')) {
            expandBtn.innerHTML = `<i class="fa-solid fa-plus mr-2 text-xs"></i>Ver todos`;
        } else {
            expandBtn.innerHTML = `<i class="fa-solid fa-minus mr-2 text-xs"></i>Ver menos`;
        }
    }
}

function expandTypeMenu() {
    const extraContainer = document.getElementById('typeExtraContainer');
    const expandBtn = document.getElementById('typeExpandBtn');
    if (extraContainer && expandBtn) {
        extraContainer.classList.toggle('hidden');
        extraContainer.classList.toggle('flex');
        if (extraContainer.classList.contains('hidden')) {
            expandBtn.innerHTML = `<i class="fa-solid fa-plus mr-2 text-xs"></i>Ver más`;
        } else {
            expandBtn.innerHTML = `<i class="fa-solid fa-minus mr-2 text-xs"></i>Ver menos`;
        }
    }
}

// --- RENDERIZADO (UI) ---
function renderApp() {
    applyFilters();
    renderHero();
    renderCatalog();
    updatePendingCount();
}

function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase();

    filteredAnimes = animes.filter(anime => {
        // Excluir pendientes (sin nota o nota = 0) del catálogo principal
        if (isPending(anime)) return false;

        // Filter by category — treat missing category as 'anime' for backwards compatibility
        const itemCategory = anime.category || 'anime';
        const matchCategory = currentCategoryFilter === 'all' || itemCategory === currentCategoryFilter;

        const matchSearch = anime.title.toLowerCase().includes(search) || 
                            (anime.genres || []).join(' ').toLowerCase().includes(search) || 
                            (anime.studio && anime.studio.toLowerCase().includes(search)) ||
                            (anime.director && anime.director.toLowerCase().includes(search)) ||
                            (anime.network && anime.network.toLowerCase().includes(search));
        
        const matchGenre = currentGenreFilter === 'all' || 
                            ((anime.genres || []).map(normalizeGenre).includes(currentGenreFilter));
        const matchType = currentTypeFilter === 'all' || anime.type === currentTypeFilter;

        return matchSearch && matchGenre && matchType && matchCategory;
    });

    if (currentSortFilter === 'rating_desc') {
        filteredAnimes.sort((a, b) => b.rating - a.rating);
    } else if (currentSortFilter === 'rating_asc') {
        filteredAnimes.sort((a, b) => a.rating - b.rating);
    }
}

function renderHero() {
    const heroEl = document.getElementById('heroSection');
    
    // Limpiar intervalo previo
    if (heroInterval) {
        clearInterval(heroInterval);
        heroInterval = null;
    }
    
    // Si no hay animes, ocultar hero
    if (filteredAnimes.length === 0) {
        heroEl.classList.add('hidden');
        document.getElementById('catalogContainer').classList.remove('md:mt-[-100px]');
        document.getElementById('catalogContainer').classList.add('mt-24');
        return;
    }

    // Tomar los mejores calificados para el carrusel (max 5)
    const featuredList = [...filteredAnimes].sort((a, b) => b.rating - a.rating).slice(0, 5);
    
    // Asegurar que el indice no se desborde si el filtro cambió
    if(currentHeroIndex >= featuredList.length) {
        currentHeroIndex = 0;
    }
    
    const featured = featuredList[currentHeroIndex];
    
    heroEl.classList.remove('hidden');
    document.getElementById('catalogContainer').classList.add('md:mt-[-100px]');
    document.getElementById('catalogContainer').classList.remove('mt-24');

    // Efecto de transición sutil al cambiar fondo
    const imageEl = document.getElementById('heroImage');
    imageEl.style.transition = "opacity 0.5s ease-in-out";
    imageEl.style.opacity = 0;
    
    setTimeout(() => {
        imageEl.style.backgroundImage = `url('${escapeCSSUrl(featured.image)}')`;
        imageEl.style.opacity = 1;
    }, 500);
    
    document.getElementById('heroTitle').textContent = featured.title;
    
    const rInfo = getRatingInfo(featured.rating);
    document.getElementById('heroRating').innerHTML = `<i class="fa-solid fa-star mr-1"></i> ${escapeHTML(featured.rating)} - ${escapeHTML(rInfo.text)} ${rInfo.icon}`;
    document.getElementById('heroType').textContent = featured.type;

    const hEpisodes = document.getElementById('heroEpisodes');
    if (featured.episodes) {
        hEpisodes.innerHTML = `<i class="fa-solid fa-list-ol mr-1"></i> ${escapeHTML(featured.episodes)} Eps`;
        hEpisodes.classList.remove('hidden');
    } else {
        hEpisodes.classList.add('hidden');
    }

    const hSeasons = document.getElementById('heroSeasons');
    if (featured.seasons) {
        hSeasons.innerHTML = `<i class="fa-solid fa-layer-group mr-1"></i> ${escapeHTML(featured.seasons)} ${featured.seasons == 1 ? 'Temp' : 'Temps'}`;
        hSeasons.classList.remove('hidden');
    } else {
        hSeasons.classList.add('hidden');
    }

    const hSeason = document.getElementById('heroSeason');
    if (featured.season) {
        hSeason.innerHTML = `<i class="fa-solid fa-calendar mr-1"></i> ${escapeHTML(featured.season)}`;
        hSeason.classList.remove('hidden');
    } else {
        hSeason.classList.add('hidden');
    }

    document.getElementById('heroStatus').textContent = featured.status;
    document.getElementById('heroSynopsis').textContent = featured.synopsis;

    // Show subtitle based on category
    const heroStudio = document.getElementById('heroStudio');
    if (heroStudio) {
        heroStudio.textContent = getSubtitle(featured);
    }

    document.getElementById('heroDetailsBtn').onclick = () => openDetailsModal(featured.id);

    // Iniciar el auto-carrusel si hay más de 1 destacado
    if (featuredList.length > 1) {
        heroInterval = setInterval(() => {
            currentHeroIndex = (currentHeroIndex + 1) % featuredList.length;
            renderHero();
        }, 5000); // 5 segundos
    }
}

function renderCatalog() {
    const catalogRowsEl = document.getElementById('catalogRows');
    const emptyEl = document.getElementById('emptyState');
    const search = document.getElementById('searchInput').value.trim();
    
    catalogRowsEl.innerHTML = '';

    if (filteredAnimes.length === 0) {
        emptyEl.classList.remove('hidden');
        catalogRowsEl.classList.add('hidden');
        return;
    } 
    
    emptyEl.classList.add('hidden');
    catalogRowsEl.classList.remove('hidden');

    const isFiltering = currentGenreFilter !== 'all' || currentTypeFilter !== 'all' || search !== '';
    const isSorting = currentSortFilter !== 'default';

    if (isFiltering) {
        // MODO GRID (Si hay algún filtro de género, tipo o búsqueda activo)
        let title = 'Resultados de la búsqueda';
        if (currentGenreFilter !== 'all') title = currentGenreFilter;
        else if (currentTypeFilter !== 'all') title = `Formato: ${currentTypeFilter}`;
        if (search !== '') title = `Búsqueda: "${search}"`;

        catalogRowsEl.appendChild(createGridContainer(title, filteredAnimes));
    } else if (isSorting) {
        // MODO GRID SIN SEPARACIÓN (Solo filtro de orden activo, sin género/tipo/búsqueda)
        const sortLabel = currentSortFilter === 'rating_desc' ? 'Mejor valorados' : 'Peor valorados';
        catalogRowsEl.appendChild(createGridContainer(sortLabel, filteredAnimes));
    } else {
        // MODO CARRUSELES (Inicio por defecto sin filtros)
        // 1. Fila de "Recientes" (Max 10 ordenados por updatedAt o si no existe, como estén)
        const recents = [...filteredAnimes]
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .slice(0, 10);
            
        if (recents.length > 0) {
            catalogRowsEl.appendChild(createCarouselRow('Recientes', recents, 'row-recents'));
        }

        // 2. Extraer los géneros únicos normalizados que existen en los resultados
        const allGenres = new Set();
        filteredAnimes.forEach(a => {
            if(a.genres) {
                a.genres.forEach(g => allGenres.add(normalizeGenre(g)));
            }
        });

        // 3. Crear una fila por cada género encontrado (Max 10 animes por género)
        Array.from(allGenres).sort().forEach((genre, index) => {
            const animesInGenre = [...filteredAnimes]
                .filter(a => a.genres && a.genres.map(normalizeGenre).includes(genre))
                .sort((a, b) => b.rating - a.rating)
                .slice(0, 10);
                
            if (animesInGenre.length > 0) {
                catalogRowsEl.appendChild(createCarouselRow(genre, animesInGenre, `row-genre-${index}`));
            }
        });
    }
}

function createGridContainer(title, animesList) {
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full mb-8';
    
    wrapper.innerHTML = `
        <h3 class="text-xl md:text-2xl font-bold mb-6 text-gray-200 px-2">${escapeHTML(title)}</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 px-2"></div>
    `;

    const gridContainer = wrapper.querySelector('div.grid');

    animesList.forEach(anime => {
        const rInfo = getRatingInfo(anime.rating);
        
        const card = document.createElement('div');
        // En modo Grid no forzamos un ancho fijo (w-44), dejamos que el grid maneje el responsive
        card.className = 'anime-card aspect-[2/3] cursor-pointer shadow-lg';
        card.onclick = () => openDetailsModal(anime.id);

        card.innerHTML = `
            <div class="anime-card-inner absolute inset-0">
                <img src="${escapeAttr(anime.image)}" alt="${escapeAttr(anime.title)}" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27300%27 height=%27450%27 fill=%27%231a1a2e%27%3E%3Crect width=%27300%27 height=%27450%27/%3E%3Ctext x=%27150%27 y=%27225%27 font-family=%27sans-serif%27 font-size=%2714%27 fill=%27%23666%27 text-anchor=%27middle%27%3ESin imagen%3C/text%3E%3C/svg%3E'">
                <div class="absolute bottom-0 w-full h-2/3 bg-gradient-to-t from-black/90 to-transparent"></div>
                <div class="card-type-badge absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded font-semibold border border-white/20">
                    ${escapeHTML(anime.type)}
                </div>
                <div class="anime-card-overlay absolute inset-0 rounded-md p-4 flex flex-col justify-between">
                    <!-- Top: tipo y estudio/director -->
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-white text-xs font-semibold bg-[#5472b3]/80 px-2 py-0.5 rounded">${escapeHTML(anime.type)}</span>
                        <span class="text-gray-300 text-xs bg-black/40 px-2 py-0.5 rounded">${escapeHTML(getInfoBadge(anime))}</span>
                    </div>
                    <!-- Bottom: info principal -->
                    <div>
                        <h3 class="font-bold text-white text-base leading-tight line-clamp-2 mb-2">${escapeHTML(anime.title)}</h3>
                        <div class="flex items-center gap-2 mb-3 flex-wrap">
                            <span class="text-[#7e57c2] font-bold text-sm"><i class="fa-solid fa-star text-xs"></i> ${escapeHTML(anime.rating)}</span>
                            <span class="text-gray-400 text-xs">·</span>
                            <span class="text-gray-300 text-xs font-semibold">${escapeHTML(rInfo.text)} ${rInfo.icon}</span>
                            ${anime.episodes ? `<span class="text-gray-400 text-xs">· ${escapeHTML(anime.episodes)} eps</span>` : ''}
                        </div>
                        <div class="py-2 rounded bg-[#5472b3] hover:bg-[#82aaff] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                            <i class="fa-solid fa-circle-info"></i> Más info
                        </div>
                    </div>
                </div>
                <div class="card-footer absolute bottom-2 left-2 right-2 pointer-events-none">
                    <h3 class="font-bold text-white text-sm line-clamp-1 drop-shadow-md">${escapeHTML(anime.title)}</h3>
                    <div class="text-xs text-[#7e57c2] font-bold drop-shadow-md"><i class="fa-solid fa-star mr-1"></i>${escapeHTML(anime.rating)}</div>
                </div>
            </div>
        `;
        gridContainer.appendChild(card);
    });

    return wrapper;
}

function createCarouselRow(title, animesList, rowId) {
    const rowWrapper = document.createElement('div');
    rowWrapper.className = 'w-full relative group';
    
    rowWrapper.innerHTML = `
        <h3 class="text-xl md:text-2xl font-bold mb-4 text-gray-200 px-2">${escapeHTML(title)}</h3>
        <div class="relative w-full">
            <!-- Left Arrow -->
            <button onclick="scrollCarousel('${rowId}', -1)" class="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#011627] via-[#011627]/80 to-transparent text-white z-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-l-md group/btn">
                <i class="fa-solid fa-chevron-left text-3xl opacity-50 group-hover/btn:opacity-100 group-hover/btn:scale-125 transition-all duration-300 drop-shadow-lg"></i>
            </button>
            
            <!-- Horizontal Scroll Container -->
            <div id="${rowId}" class="carousel-container flex gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory px-4 pb-8 pt-8">
            </div>

            <!-- Right Arrow -->
            <button onclick="scrollCarousel('${rowId}', 1)" class="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#011627] via-[#011627]/80 to-transparent text-white z-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-r-md group/btn">
                <i class="fa-solid fa-chevron-right text-3xl opacity-50 group-hover/btn:opacity-100 group-hover/btn:scale-125 transition-all duration-300 drop-shadow-lg"></i>
            </button>
        </div>
    `;

    const carouselContainer = rowWrapper.querySelector(`#${rowId}`);

    animesList.forEach(anime => {
        const rInfo = getRatingInfo(anime.rating);
        
        const card = document.createElement('div');
        // El ancho de cada tarjeta aumentado para que luzcan como un póster real
        card.className = 'anime-card flex-none w-44 sm:w-48 md:w-56 lg:w-64 xl:w-72 aspect-[2/3] cursor-pointer shadow-lg snap-start relative';
        card.onclick = () => openDetailsModal(anime.id);

        card.innerHTML = `
            <div class="anime-card-inner absolute inset-0">
                <img src="${escapeAttr(anime.image)}" alt="${escapeAttr(anime.title)}" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27300%27 height=%27450%27 fill=%27%231a1a2e%27%3E%3Crect width=%27300%27 height=%27450%27/%3E%3Ctext x=%27150%27 y=%27225%27 font-family=%27sans-serif%27 font-size=%2714%27 fill=%27%23666%27 text-anchor=%27middle%27%3ESin imagen%3C/text%3E%3C/svg%3E'">
                <div class="absolute bottom-0 w-full h-2/3 bg-gradient-to-t from-black/90 to-transparent"></div>
                <div class="card-type-badge absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded font-semibold border border-white/20">
                    ${escapeHTML(anime.type)}
                </div>
                <div class="anime-card-overlay absolute inset-0 rounded-md p-4 flex flex-col justify-between">
                    <!-- Top: tipo y estudio/director -->
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-white text-xs font-semibold bg-[#5472b3]/80 px-2 py-0.5 rounded">${escapeHTML(anime.type)}</span>
                        <span class="text-gray-300 text-xs bg-black/40 px-2 py-0.5 rounded">${escapeHTML(getInfoBadge(anime))}</span>
                    </div>
                    <!-- Bottom: info principal -->
                    <div>
                        <h3 class="font-bold text-white text-base leading-tight line-clamp-2 mb-2">${escapeHTML(anime.title)}</h3>
                        <div class="flex items-center gap-2 mb-3 flex-wrap">
                            <span class="text-[#7e57c2] font-bold text-sm"><i class="fa-solid fa-star text-xs"></i> ${escapeHTML(anime.rating)}</span>
                            <span class="text-gray-400 text-xs">·</span>
                            <span class="text-gray-300 text-xs font-semibold">${escapeHTML(rInfo.text)} ${rInfo.icon}</span>
                            ${anime.episodes ? `<span class="text-gray-400 text-xs">· ${escapeHTML(anime.episodes)} eps</span>` : ''}
                        </div>
                        <div class="py-2 rounded bg-[#5472b3] hover:bg-[#82aaff] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                            <i class="fa-solid fa-circle-info"></i> Más info
                        </div>
                    </div>
                </div>
                <div class="card-footer absolute bottom-2 left-2 right-2 pointer-events-none">
                    <h3 class="font-bold text-white text-sm line-clamp-1 drop-shadow-md">${escapeHTML(anime.title)}</h3>
                    <div class="text-xs text-[#7e57c2] font-bold drop-shadow-md"><i class="fa-solid fa-star mr-1"></i>${escapeHTML(anime.rating)}</div>
                </div>
            </div>
        `;
        carouselContainer.appendChild(card);
    });

    return rowWrapper;
}

function scrollCarousel(id, direction) {
    const container = document.getElementById(id);
    if (!container) return;
    
    // Desplaza aproximadamente el ancho de 3 tarjetas (calculado)
    const scrollAmount = container.clientWidth * 0.7;
    container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// --- MODALES Y EVENTOS ---
function openFormModal(id = null, asPending = false) {
    currentEditingId = id;
    const form = document.getElementById('animeForm');
    
    if (id) {
        document.getElementById('formTitle').textContent = 'Editar Contenido';
        const anime = animes.find(a => a.id === id);
        if (anime) {
            document.getElementById('title').value = anime.title;
            document.getElementById('image').value = anime.image;
            document.getElementById('type').value = anime.type;
            document.getElementById('studio').value = anime.studio || '';
            document.getElementById('status').value = anime.status;
            document.getElementById('episodes').value = anime.episodes || '';
            document.getElementById('seasons').value = anime.seasons || '';
            document.getElementById('season').value = anime.season || '';
            document.getElementById('genres').value = (anime.genres || []).join(', ');
            document.getElementById('rating').value = anime.rating || '';
            document.getElementById('synopsis').value = anime.synopsis;
            document.getElementById('review').value = anime.review || '';
            // New fields
            document.getElementById('director').value = anime.director || '';
            document.getElementById('network').value = anime.network || '';
            document.getElementById('runtime').value = anime.runtime || '';
            document.getElementById('releaseYear').value = anime.releaseYear || '';
            document.getElementById('category').value = anime.category || 'anime';
        }
    } else {
        form.reset();
        document.getElementById('category').value = 'anime';
        if (asPending) {
            document.getElementById('formTitle').textContent = 'Añadir Pendiente';
            // Rating vacío = 0, queda como pendiente hasta que el usuario lo califique
            document.getElementById('rating').value = '';
        } else {
            document.getElementById('formTitle').textContent = 'Añadir Contenido';
        }
    }
    
    updateFormFieldsVisibility();
    updateRatingPreview();
    document.getElementById('formModal').classList.remove('hidden');
    document.getElementById('formModal').classList.add('flex');
}

function openDetailsModal(id) {
    currentDetailId = id;
    const anime = animes.find(a => a.id === id);
    if (!anime) return;

    document.getElementById('detailImage').style.backgroundImage = `url('${escapeCSSUrl(anime.image)}')`;
    document.getElementById('detailTitle').textContent = anime.title;
    
    if (isPending(anime)) {
        document.getElementById('detailRatingText').innerHTML = `<i class="fa-solid fa-clock mr-1 text-brand-400"></i> <span class="text-brand-500">Sin calificar — Pendiente</span>`;
    } else {
        const rInfo = getRatingInfo(anime.rating);
        document.getElementById('detailRatingText').innerHTML = `<i class="fa-solid fa-star mr-1"></i> ${escapeHTML(anime.rating)} <span class="text-white ml-2">${escapeHTML(rInfo.text)} <span class="ml-1">${rInfo.icon}</span></span>`;
    }
    
    document.getElementById('detailType').textContent = anime.type;

    const dEpisodes = document.getElementById('detailEpisodes');
    if (anime.episodes) {
        dEpisodes.innerHTML = `<i class="fa-solid fa-list-ol mr-1"></i> ${escapeHTML(anime.episodes)} Eps`;
        dEpisodes.classList.remove('hidden');
    } else {
        dEpisodes.classList.add('hidden');
    }

    const dSeasons = document.getElementById('detailSeasons');
    if (anime.seasons) {
        dSeasons.innerHTML = `<i class="fa-solid fa-layer-group mr-1"></i> ${escapeHTML(anime.seasons)} ${anime.seasons == 1 ? 'Temp' : 'Temps'}`;
        dSeasons.classList.remove('hidden');
    } else {
        dSeasons.classList.add('hidden');
    }

    const dSeason = document.getElementById('detailSeason');
    if (anime.season) {
        dSeason.innerHTML = `<i class="fa-solid fa-calendar mr-1"></i> ${escapeHTML(anime.season)}`;
        dSeason.classList.remove('hidden');
    } else {
        dSeason.classList.add('hidden');
    }

    document.getElementById('detailStatus').textContent = anime.status;
    
    // Show studio for anime, director/network for general
    const detailStudio = document.getElementById('detailStudio');
    const cat = anime.category || 'anime';
    if (cat === 'general') {
        const parts = [];
        if (anime.director) parts.push(anime.director);
        if (anime.network) parts.push(anime.network);
        detailStudio.textContent = parts.join(' · ') || 'Desconocido';
    } else {
        detailStudio.textContent = anime.studio || 'Estudio Desconocido';
    }
    
    document.getElementById('detailSynopsis').textContent = anime.synopsis;
    
    const reviewEl = document.getElementById('detailReview');
    if(anime.review && anime.review.trim() !== '') {
        reviewEl.textContent = anime.review;
        reviewEl.parentElement.classList.remove('hidden');
    } else {
        reviewEl.parentElement.classList.add('hidden');
    }

    const genresContainer = document.getElementById('detailGenres');
    genresContainer.innerHTML = '';
    (anime.genres || []).forEach(g => {
        const span = document.createElement('span');
        span.className = 'bg-brand-600/30 border border-brand-500 text-brand-300 text-xs px-2 py-1 rounded-full font-semibold';
        span.textContent = g;
        genresContainer.appendChild(span);
    });

    // Extra fields based on category and type
    const extraFieldsEl = document.getElementById('detailExtraFields');
    extraFieldsEl.innerHTML = '';
    
    const catDetail = anime.category || 'anime';
    const isMovie = catDetail === 'general' && anime.type === 'Película';
    
    if (catDetail === 'general' && isMovie) {
        // Movie fields
        if (anime.director) {
            extraFieldsEl.innerHTML += `<div><span class="text-gray-500">Director:</span> <span class="text-white">${escapeHTML(anime.director)}</span></div>`;
        }
        if (anime.runtime) {
            extraFieldsEl.innerHTML += `<div><span class="text-gray-500">Duración:</span> <span class="text-white">${escapeHTML(anime.runtime)} min</span></div>`;
        }
        if (anime.releaseYear) {
            extraFieldsEl.innerHTML += `<div><span class="text-gray-500">Año:</span> <span class="text-white">${escapeHTML(anime.releaseYear)}</span></div>`;
        }
    } else if (catDetail === 'general' && !isMovie) {
        // Series fields
        if (anime.director) {
            extraFieldsEl.innerHTML += `<div><span class="text-gray-500">Creador:</span> <span class="text-white">${escapeHTML(anime.director)}</span></div>`;
        }
        if (anime.network) {
            extraFieldsEl.innerHTML += `<div><span class="text-gray-500">Plataforma:</span> <span class="text-white">${escapeHTML(anime.network)}</span></div>`;
        }
        if (anime.episodes) {
            extraFieldsEl.innerHTML += `<div><span class="text-gray-500">Episodios:</span> <span class="text-white">${escapeHTML(anime.episodes)}</span></div>`;
        }
        if (anime.seasons) {
            extraFieldsEl.innerHTML += `<div><span class="text-gray-500">Temporadas:</span> <span class="text-white">${escapeHTML(anime.seasons)}</span></div>`;
        }
        if (anime.releaseYear) {
            extraFieldsEl.innerHTML += `<div><span class="text-gray-500">Año:</span> <span class="text-white">${escapeHTML(anime.releaseYear)}</span></div>`;
        }
    } else {
        // Anime fields
        if (anime.studio) {
            extraFieldsEl.innerHTML += `<div><span class="text-gray-500">Estudio:</span> <span class="text-white">${escapeHTML(anime.studio)}</span></div>`;
        }
        if (anime.episodes) {
            extraFieldsEl.innerHTML += `<div><span class="text-gray-500">Episodios:</span> <span class="text-white">${escapeHTML(anime.episodes)}</span></div>`;
        }
        if (anime.seasons) {
            extraFieldsEl.innerHTML += `<div><span class="text-gray-500">Temporadas:</span> <span class="text-white">${escapeHTML(anime.seasons)}</span></div>`;
        }
        if (anime.season) {
            extraFieldsEl.innerHTML += `<div><span class="text-gray-500">Temporada:</span> <span class="text-white">${escapeHTML(anime.season)}</span></div>`;
        }
    }

    // Botones de acción
    const btnEdit = document.getElementById('btnEdit');
    if (isPending(anime)) {
        btnEdit.innerHTML = '<i class="fa-solid fa-star mr-2"></i> Calificar';
        btnEdit.className = 'bg-[#82aaff] hover:bg-[#5472b3] text-white font-bold py-2 px-4 rounded transition flex items-center justify-center';
    } else {
        btnEdit.innerHTML = '<i class="fa-solid fa-pen mr-2"></i> Editar';
        btnEdit.className = 'bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition flex items-center justify-center';
    }
    btnEdit.onclick = () => {
        closeModal('detailsModal');
        openFormModal(anime.id);
    };
    
    document.getElementById('btnDelete').onclick = () => {
        deleteAnime(anime.id);
    };

    document.getElementById('detailsModal').classList.remove('hidden');
    document.getElementById('detailsModal').classList.add('flex');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function updateFormFieldsVisibility() {
    const category = document.getElementById('category').value;
    const type = document.getElementById('type').value;
    
    // Series (regardless of category) show episodes/seasons like anime
    // Only movies show runtime and hide episodes/seasons
    const isMovie = category === 'general' && type === 'Película';
    const isSeries = type === 'Serie' || (category === 'anime' && !isMovie);
    
    const studioGroup = document.getElementById('studioGroup');
    const directorGroup = document.getElementById('directorGroup');
    const networkGroup = document.getElementById('networkGroup');
    const runtimeGroup = document.getElementById('runtimeGroup');
    const releaseYearGroup = document.getElementById('releaseYearGroup');
    const episodesGroup = document.getElementById('episodesGroup');
    const seasonsGroup = document.getElementById('seasonsGroup');
    const seasonGroup = document.getElementById('seasonGroup');
    const statusGroup = document.getElementById('statusGroup');

    const statusSelect = document.getElementById('status');

    if (category === 'anime') {
        // Anime: studio, episodes, seasons, season, status
        studioGroup.classList.remove('hidden');
        directorGroup.classList.add('hidden');
        networkGroup.classList.add('hidden');
        runtimeGroup.classList.add('hidden');
        releaseYearGroup.classList.add('hidden');
        episodesGroup.classList.remove('hidden');
        seasonsGroup.classList.remove('hidden');
        seasonGroup.classList.remove('hidden');
        statusGroup.classList.remove('hidden');
        statusSelect.setAttribute('required', 'required');
    } else if (isMovie) {
        // Movie: director, runtime, releaseYear — NO episodes/seasons/status
        studioGroup.classList.add('hidden');
        directorGroup.classList.remove('hidden');
        networkGroup.classList.add('hidden');
        runtimeGroup.classList.remove('hidden');
        releaseYearGroup.classList.remove('hidden');
        episodesGroup.classList.add('hidden');
        seasonsGroup.classList.add('hidden');
        seasonGroup.classList.add('hidden');
        statusGroup.classList.add('hidden');
        statusSelect.removeAttribute('required');
    } else {
        // Series: director, network, episodes, seasons, releaseYear — NO status/studio/runtime
        studioGroup.classList.add('hidden');
        directorGroup.classList.remove('hidden');
        networkGroup.classList.remove('hidden');
        runtimeGroup.classList.add('hidden');
        releaseYearGroup.classList.remove('hidden');
        episodesGroup.classList.remove('hidden');
        seasonsGroup.classList.remove('hidden');
        seasonGroup.classList.add('hidden');
        statusGroup.classList.add('hidden');
        statusSelect.removeAttribute('required');
    }
}

function setupEventListeners() {
    // Scroll navbar effect
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (window.scrollY > 50) {
            nav.classList.add('nav-scrolled');
        } else {
            nav.classList.remove('nav-scrolled');
        }
    });

    // Filtros y Búsqueda (debounced to avoid full DOM rebuild per keystroke)
    document.getElementById('searchInput').addEventListener('input', debounce(() => {
        if (isPendingView) {
            renderPending();
        } else {
            currentHeroIndex = 0;
            renderApp();
        }
    }, 200));

    // Botón Pendientes
    document.getElementById('pendingBtn').addEventListener('click', () => {
        if (isPendingView) {
            closePendingView();
        } else {
            openPendingView();
        }
    });

    // Botón Añadir
    document.getElementById('addAnimeBtn').addEventListener('click', () => openFormModal());

    // Rating Preview (Al escribir o cambiar)
    document.getElementById('rating').addEventListener('input', updateRatingPreview);

    // Guardar Formulario
    document.getElementById('animeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Parsear géneros (separados por coma a un array limpio)
        const genresInput = document.getElementById('genres').value;
        const genresArray = genresInput.split(',').map(g => g.trim()).filter(g => g !== '');

        const ratingRaw = document.getElementById('rating').value;
        const category = document.getElementById('category').value;
        const type = document.getElementById('type').value;
        const isMovie = category === 'general' && type === 'Película';
        
        const animeData = {
            title: document.getElementById('title').value.trim(),
            image: document.getElementById('image').value.trim(),
            type: type,
            status: category === 'anime' ? document.getElementById('status').value : null,
            genres: genresArray.length > 0 ? genresArray : ['Sin Clasificar'],
            rating: ratingRaw !== '' ? parseFloat(ratingRaw) : 0,
            synopsis: document.getElementById('synopsis').value.trim(),
            review: document.getElementById('review').value.trim(),
            category: category,
            // Anime-specific fields (also for series)
            studio: category === 'anime' ? document.getElementById('studio').value.trim() : null,
            episodes: !isMovie && document.getElementById('episodes').value ? parseInt(document.getElementById('episodes').value) : null,
            seasons: !isMovie && document.getElementById('seasons').value ? parseInt(document.getElementById('seasons').value) : null,
            season: category === 'anime' ? document.getElementById('season').value.trim() : null,
            // General-specific fields
            director: category === 'general' ? document.getElementById('director').value.trim() : null,
            network: category === 'general' ? document.getElementById('network').value.trim() : null,
            runtime: isMovie && document.getElementById('runtime').value ? parseInt(document.getElementById('runtime').value) : null,
            releaseYear: category === 'general' && document.getElementById('releaseYear').value ? parseInt(document.getElementById('releaseYear').value) : null,
        };

        await saveAnime(animeData);
    });

    // Category change listener
    document.getElementById('category').addEventListener('change', updateFormFieldsVisibility);
    // Type change listener — affects field visibility for general content
    document.getElementById('type').addEventListener('change', updateFormFieldsVisibility);

    // Recargar datos cuando la pestaña recupera el foco (para reflejar cambios externos al JSON)
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            await loadData();
            if (isPendingView) {
                renderPending();
                updatePendingCount();
            } else {
                renderApp();
            }
        }
    });

    // Cerrar modal al hacer clic afuera (fondo oscuro) y dropdowns
    window.addEventListener('click', (e) => {
        if (e.target.id === 'formModal') closeModal('formModal');
        if (e.target.id === 'detailsModal') closeModal('detailsModal');
        
        // Cerrar custom dropdowns si el clic no es dentro de su contenedor
        if (!e.target.closest('#genreFilterContainer') &&
            !e.target.closest('#sortFilterContainer') &&
            !e.target.closest('#typeFilterContainer')) {
            closeAllDropdowns();
        }
    });

    // Cerrar dropdowns con Escape y navegación con teclado
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllDropdowns();
            closeModal('formModal');
            closeModal('detailsModal');
        }
    });
}

// --- ARRANQUE ---
document.addEventListener('DOMContentLoaded', init);