const ENABLE_PREVIEWS = true;

const ALBUMS_BY_TITLE = new Map(ALBUMS.map(a => [a.title, a]));

function realTrackCount(tracklist){
  return tracklist.filter(t => !t.startsWith("—")).length;
}

function initials(title){
  return title.replace(/[^A-Za-z0-9' ]/g," ").split(" ").filter(Boolean).slice(0,2)
    .map(w=>w[0]).join("").toUpperCase();
}

function shuffle(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCollage(){
  const el = document.getElementById("bgCollage");
  const urls = Object.values(COVERS);
  if (!el || !urls.length) return;
  const cell = 170;
  const cols = Math.ceil((window.innerWidth + 60) / cell) + 2;
  const rows = Math.ceil((window.innerHeight + 60) / cell) + 2;

  const frag = document.createDocumentFragment();
  for (let r = 0; r < rows; r++){
    const rowEl = document.createElement("div");
    rowEl.className = "bg-row " + (r % 2 === 0 ? "dir-left" : "dir-right");
    rowEl.style.animationDuration = (55 + (r % 3) * 15) + "s";

    const shuffled = shuffle(urls);
    const rowUrls = [];
    for (let c = 0; c < cols; c++) rowUrls.push(shuffled[c % shuffled.length]);

    // duplicate the row's images so translateX(-50%) loops seamlessly
    for (let rep = 0; rep < 2; rep++){
      rowUrls.forEach((src) => {
        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        img.loading = (r < 2 && rep === 0) ? "eager" : "lazy";
        rowEl.appendChild(img);
      });
    }
    frag.appendChild(rowEl);
  }
  el.innerHTML = "";
  el.appendChild(frag);
}
buildCollage();
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    buildCollage();
    sizeCards();
  }, 400);
});

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const BG_PARALLAX_FACTOR = 0.25;
const BG_PARALLAX_MAX = 60;

function updateBgParallax(){
  const el = document.getElementById("bgCollage");
  if (!el) return;
  const offset = Math.min(window.scrollY * BG_PARALLAX_FACTOR, BG_PARALLAX_MAX);
  el.style.transform = `translateY(${-offset}px)`;
}

if (!prefersReducedMotion) {
  let bgParallaxTicking = false;
  window.addEventListener("scroll", () => {
    if (bgParallaxTicking) return;
    bgParallaxTicking = true;
    requestAnimationFrame(() => {
      updateBgParallax();
      bgParallaxTicking = false;
    });
  }, { passive: true });
  updateBgParallax();
}

const chipsEl = document.getElementById("chips");
const allChip = document.createElement("button");
allChip.className = "chip"; allChip.textContent = "All"; allChip.setAttribute("aria-pressed","true");
allChip.dataset.cat = "all";
chipsEl.appendChild(allChip);
Object.entries(CATS).forEach(([key, c]) => {
  const b = document.createElement("button");
  b.className = "chip"; b.setAttribute("aria-pressed","false"); b.dataset.cat = key;
  b.textContent = c.label;
  chipsEl.appendChild(b);
});

let activeCat = "all";
chipsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  activeCat = btn.dataset.cat;
  [...chipsEl.children].forEach(c => c.setAttribute("aria-pressed", c === btn ? "true" : "false"));
  render();
});

const yearSortUpEl = document.getElementById("yearSortUp");
const yearSortDownEl = document.getElementById("yearSortDown");
const storedOrderPref = localStorage.getItem("elvisReverseOrder");
let reverseOrder = storedOrderPref === null ? true : storedOrderPref === "true";

function updateYearSortButtons(){
  yearSortUpEl.setAttribute("aria-pressed", String(reverseOrder));
  yearSortDownEl.setAttribute("aria-pressed", String(!reverseOrder));
}
updateYearSortButtons();

function setReverseOrder(value){
  if (reverseOrder === value) return;
  reverseOrder = value;
  updateYearSortButtons();
  localStorage.setItem("elvisReverseOrder", String(reverseOrder));
  render();
}

yearSortUpEl.addEventListener("click", () => setReverseOrder(true));
yearSortDownEl.addEventListener("click", () => setReverseOrder(false));

const qInput = document.getElementById("q");
const suggestionsEl = document.getElementById("suggestions");

const SUGGESTIONS = [];
ALBUMS.forEach(album => {
  SUGGESTIONS.push({ type: "album", label: album.title, album });
  album.tracklist.forEach(t => {
    if (!t.startsWith("—")) SUGGESTIONS.push({ type: "song", label: t, album });
  });
});

let currentSuggestions = [];
let activeSuggestionIndex = -1;

function closeSuggestions(){
  suggestionsEl.hidden = true;
  suggestionsEl.innerHTML = "";
  currentSuggestions = [];
  activeSuggestionIndex = -1;
  qInput.setAttribute("aria-expanded", "false");
}

function updateActiveSuggestion(){
  [...suggestionsEl.children].forEach((li, i) => {
    li.classList.toggle("active", i === activeSuggestionIndex);
  });
  const activeEl = suggestionsEl.children[activeSuggestionIndex];
  if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
}

function renderSuggestions(){
  const query = qInput.value.trim().toLowerCase();
  if (!query) { closeSuggestions(); return; }

  currentSuggestions = SUGGESTIONS
    .filter(s => s.label.toLowerCase().includes(query))
    .sort((a, b) => (a.type === b.type ? 0 : a.type === "album" ? -1 : 1))
    .slice(0, 8);

  if (currentSuggestions.length === 0) { closeSuggestions(); return; }

  suggestionsEl.innerHTML = currentSuggestions.map((s, i) => `
    <li class="suggestion" role="option" data-index="${i}">
      <span class="s-label">${escAttr(s.label)}</span>
      <span class="s-sub">${s.type === "album" ? "Album" : escAttr(s.album.title)}</span>
    </li>
  `).join("");
  suggestionsEl.hidden = false;
  activeSuggestionIndex = -1;
  qInput.setAttribute("aria-expanded", "true");
}

function flashHighlight(el){
  el.classList.remove("search-highlight");
  void el.offsetWidth;
  el.classList.add("search-highlight");
  setTimeout(() => el.classList.remove("search-highlight"), 1700);
}

function findCardForAlbum(album){
  return [...document.querySelectorAll(".card")].find(c => c.querySelector(".title").textContent.trim() === album.title) || null;
}

function selectSuggestion(s){
  qInput.value = "";
  render();
  closeSuggestions();

  setTimeout(() => {
    const card = findCardForAlbum(s.album);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    flashHighlight(card);

    if (s.type === "song") {
      if (!card.classList.contains("flipped")) card.click();
      setTimeout(() => {
        const row = [...card.querySelectorAll(".tracklist .track-name")]
          .find(el => el.textContent.trim() === s.label);
        if (row) {
          const li = row.closest("li");
          li.scrollIntoView({ behavior: "smooth", block: "center" });
          flashHighlight(li);
        }
      }, 350);
    }
  }, 0);
}

qInput.addEventListener("input", () => {
  render();
  renderSuggestions();
});

qInput.addEventListener("keydown", (e) => {
  if (suggestionsEl.hidden) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, currentSuggestions.length - 1);
    updateActiveSuggestion();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
    updateActiveSuggestion();
  } else if (e.key === "Enter") {
    if (activeSuggestionIndex >= 0) {
      e.preventDefault();
      selectSuggestion(currentSuggestions[activeSuggestionIndex]);
    }
  } else if (e.key === "Escape") {
    closeSuggestions();
  }
});

suggestionsEl.addEventListener("click", (e) => {
  const li = e.target.closest(".suggestion");
  if (!li) return;
  selectSuggestion(currentSuggestions[parseInt(li.dataset.index, 10)]);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search")) closeSuggestions();
});

const erasEl = document.getElementById("eras");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");

document.getElementById("stat-albums").textContent = ALBUMS.length;
document.getElementById("stat-tracks").textContent =
  ALBUMS.reduce((sum,a)=>sum+realTrackCount(a.tracklist),0) + "+";

function matches(album, query, cat){
  if (cat !== "all" && album.category !== cat) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  if (album.title.toLowerCase().includes(q)) return true;
  return album.tracklist.some(t => t.toLowerCase().includes(q));
}

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("revealed");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

const eraNavEl = document.getElementById("eraNav");
const eraNavLabelEl = document.getElementById("eraNavLabel");
let eraObserver = null;

const heroObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    eraNavEl.classList.toggle("visible", !entry.isIntersecting);
  });
}, { threshold: 0 });
heroObserver.observe(document.querySelector(".hero"));

function buildEraNav(sections){
  eraNavEl.innerHTML = sections.map(sec =>
    `<a href="#${sec.id}" aria-label="${sec.dataset.navLabel}"><span class="era-tick"></span><span class="era-label-text">${sec.dataset.navLabel}</span></a>`
  ).join("");

  if (eraObserver) eraObserver.disconnect();
  eraObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const link = eraNavEl.querySelector(`a[href="#${entry.target.id}"]`);
      if (!link) return;
      [...eraNavEl.children].forEach(a => a.classList.remove("active"));
      link.classList.add("active");
    });
  }, { rootMargin: "-15% 0px -75% 0px", threshold: 0 });

  sections.forEach(sec => eraObserver.observe(sec));
}

window.addEventListener("scroll", () => {
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  if (atBottom && eraNavEl.lastElementChild) {
    [...eraNavEl.children].forEach(a => a.classList.remove("active"));
    eraNavEl.lastElementChild.classList.add("active");
  }
});

function linkFromPointer(e){
  const links = [...eraNavEl.children];
  if (!links.length) return null;
  const rect = eraNavEl.getBoundingClientRect();
  const fraction = (e.clientY - rect.top) / rect.height;
  const idx = Math.min(Math.max(Math.floor(fraction * links.length), 0), links.length - 1);
  return links[idx];
}

function showEraLabel(link, e){
  eraNavLabelEl.textContent = link.getAttribute("aria-label");
  eraNavLabelEl.hidden = false;
  eraNavLabelEl.style.top = e.clientY + "px";
  const rect = eraNavEl.getBoundingClientRect();
  eraNavLabelEl.style.right = (window.innerWidth - rect.left + 12) + "px";
}

function hideEraLabel(){
  eraNavLabelEl.hidden = true;
}

let scrubbing = false;

function scrubTo(e){
  const link = linkFromPointer(e);
  if (!link) return;
  const target = document.getElementById(link.getAttribute("href").slice(1));
  if (target) target.scrollIntoView({ behavior: "auto", block: "start" });
  [...eraNavEl.children].forEach(a => a.classList.remove("active"));
  link.classList.add("active");
  showEraLabel(link, e);
}

eraNavEl.addEventListener("pointerdown", (e) => {
  scrubbing = true;
  eraNavEl.setPointerCapture(e.pointerId);
  scrubTo(e);
  e.preventDefault();
});
eraNavEl.addEventListener("pointermove", (e) => {
  if (!scrubbing) return;
  scrubTo(e);
});
eraNavEl.addEventListener("pointerup", (e) => {
  scrubbing = false;
  eraNavEl.releasePointerCapture(e.pointerId);
  hideEraLabel();
});
eraNavEl.addEventListener("pointercancel", () => {
  scrubbing = false;
  hideEraLabel();
});

function render(){
  const query = qInput.value.trim();
  const visible = new Set(ALBUMS.filter(a => matches(a, query, activeCat)));
  erasEl.innerHTML = "";

  countEl.textContent = visible.size === ALBUMS.length
    ? `${ALBUMS.length} albums`
    : `${visible.size} of ${ALBUMS.length} albums`;

  emptyEl.hidden = visible.size !== 0;

  const placed = new Set();
  const renderedSections = [];
  const orderedEras = reverseOrder ? ERAS.slice().reverse() : ERAS;

  orderedEras.forEach((era, i) => {
    const eraAlbums = era.albums
      .map(title => ALBUMS_BY_TITLE.get(title))
      .filter(album => visible.has(album) && !placed.has(album));
    if (eraAlbums.length === 0) return;
    eraAlbums.forEach(album => placed.add(album));

    const section = document.createElement("section");
    section.className = "era";
    section.id = `era-${i}`;
    const heading = era.years ? `${era.title} (${era.years})` : era.title;
    section.dataset.navLabel = heading;
    section.innerHTML = `<div class="era-head"><h2>${heading}</h2></div>`;
    const grid = document.createElement("div");
    grid.className = "grid";
    section.appendChild(grid);
    erasEl.appendChild(section);
    renderedSections.push(section);

    eraAlbums.forEach(album => {
      const card = renderCard(album);
      grid.appendChild(card);
      revealObserver.observe(card);
    });
  });

  buildEraNav(renderedSections);

  sizeCards();
}

function sizeCards(){
  const cards = [...document.querySelectorAll(".card")];
  let restHeight = 0;
  cards.forEach(card => {
    const front = card.querySelector(".face-front");
    restHeight = Math.max(restHeight, front.scrollHeight);
  });
  cards.forEach(card => {
    card.dataset.restHeight = restHeight;
    if (card.classList.contains("flipped")) {
      const back = card.querySelector(".face-back");
      card.style.height = Math.max(restHeight, back.scrollHeight) + "px";
    } else {
      card.style.height = restHeight + "px";
    }
  });
}

function escAttr(s){
  return s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

const PLAY_ICON = `<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>`;
const PAUSE_ICON = `<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><rect x="6" y="4.5" width="4.5" height="15"/><rect x="13.5" y="4.5" width="4.5" height="15"/></svg>`;

function getPreview(albumTitle, trackName){
  return ALBUM_TRACK_PREVIEWS[albumTitle + "|||" + trackName] || TRACK_PREVIEWS[trackName];
}

function trackItemsHtml(albumTitle, tracklist){
  return tracklist.map((t, i) => {
    if (t.startsWith("—")) {
      return `<li class="divider">${t.replace(/—/g,"").trim()}</li>`;
    }
    const n = tracklist.slice(0, i).filter(x=>!x.startsWith("—")).length + 1;
    const safe = escAttr(t);
    let btn = "";
    if (ENABLE_PREVIEWS) {
      const preview = getPreview(albumTitle, t);
      btn = preview
        ? `<button type="button" class="play-btn" data-track="${safe}" data-index="${i}" aria-label="Play 30-second preview of ${safe}">${PLAY_ICON}</button>`
        : `<button type="button" class="play-btn" disabled aria-label="No preview available for ${safe}">${PLAY_ICON}</button>`;
    }
    return `<li><span class="num">${n}.</span><span class="track-name" title="${safe}">${t}</span>${btn}</li>`;
  }).join("");
}

const previewAudio = document.getElementById("previewAudio");
const nowPlayingEl = document.getElementById("nowPlaying");
const npCover = document.getElementById("npCover");
const npTrack = document.getElementById("npTrack");
const npAlbum = document.getElementById("npAlbum");
const npAutoplayBtn = document.getElementById("npAutoplay");
const npCloseBtn = document.getElementById("npClose");
const npPlayPauseBtn = document.getElementById("npPlayPause");

let currentPlayingBtn = null;
let currentCard = null;
let currentAlbum = null;
let currentTrackIndex = -1;
let autoplayEnabled = localStorage.getItem("elvisAutoplay") === "true";
npAutoplayBtn.setAttribute("aria-pressed", String(autoplayEnabled));

npAutoplayBtn.addEventListener("click", () => {
  autoplayEnabled = !autoplayEnabled;
  npAutoplayBtn.setAttribute("aria-pressed", String(autoplayEnabled));
  localStorage.setItem("elvisAutoplay", String(autoplayEnabled));
});

npCloseBtn.addEventListener("click", () => {
  stopPreview();
  hideNowPlaying();
});

npPlayPauseBtn.addEventListener("click", () => {
  if (!currentAlbum) return;
  if (previewAudio.paused) {
    resumePreview();
  } else {
    pausePreview();
  }
});

function showNowPlaying(album, trackName){
  npCover.src = COVERS[album.title] || "";
  npTrack.textContent = trackName;
  npAlbum.textContent = album.title;
  nowPlayingEl.hidden = false;
  nowPlayingEl.classList.add("spinning");
  npPlayPauseBtn.innerHTML = PAUSE_ICON;
  npPlayPauseBtn.setAttribute("aria-label", "Pause");
}

function pausePreview(){
  previewAudio.pause();
  nowPlayingEl.classList.remove("spinning");
  npPlayPauseBtn.innerHTML = PLAY_ICON;
  npPlayPauseBtn.setAttribute("aria-label", "Play");
  if (currentPlayingBtn) {
    currentPlayingBtn.innerHTML = PLAY_ICON;
  }
}

function resumePreview(){
  previewAudio.play().catch(() => {});
  nowPlayingEl.classList.add("spinning");
  npPlayPauseBtn.innerHTML = PAUSE_ICON;
  npPlayPauseBtn.setAttribute("aria-label", "Pause");
  if (currentPlayingBtn) {
    currentPlayingBtn.innerHTML = PAUSE_ICON;
  }
}

function hideNowPlaying(){
  nowPlayingEl.hidden = true;
  nowPlayingEl.classList.remove("spinning");
  currentCard = null;
  currentAlbum = null;
  currentTrackIndex = -1;
}

function stopPreview(){
  previewAudio.pause();
  if (currentPlayingBtn) {
    currentPlayingBtn.innerHTML = PLAY_ICON;
    currentPlayingBtn.closest("li").classList.remove("playing");
    currentPlayingBtn = null;
  }
  nowPlayingEl.classList.remove("spinning");
}

function findTrackButton(card, trackName){
  return [...card.querySelectorAll(".play-btn")].find(b => b.dataset.track === trackName) || null;
}

function nextPlayableTrack(albumTitle, tracklist, fromIndex){
  for (let i = fromIndex + 1; i < tracklist.length; i++){
    const t = tracklist[i];
    if (t.startsWith("—")) continue;
    if (getPreview(albumTitle, t)) return i;
  }
  return -1;
}

function playTrackAt(card, album, index){
  const title = album.tracklist[index];
  const preview = getPreview(album.title, title);
  const btn = findTrackButton(card, title);
  if (!preview || !btn) return false;

  stopPreview();
  previewAudio.src = preview.previewUrl;
  previewAudio.play().catch(() => {});
  btn.innerHTML = PAUSE_ICON;
  btn.closest("li").classList.add("playing");
  currentPlayingBtn = btn;
  currentCard = card;
  currentAlbum = album;
  currentTrackIndex = index;
  showNowPlaying(album, title);
  return true;
}

previewAudio.addEventListener("ended", () => {
  if (autoplayEnabled && currentCard && currentAlbum) {
    const nextIndex = nextPlayableTrack(currentAlbum.title, currentAlbum.tracklist, currentTrackIndex);
    if (nextIndex !== -1 && playTrackAt(currentCard, currentAlbum, nextIndex)) return;
  }
  stopPreview();
  hideNowPlaying();
});

function wirePlayButtons(card, album){
  card.querySelectorAll(".play-btn").forEach(btn => {
    const play = (e) => {
      e.stopPropagation();
      if (btn.disabled) return;

      if (btn === currentPlayingBtn) {
        if (previewAudio.paused) {
          resumePreview();
        } else {
          pausePreview();
        }
        return;
      }

      const index = parseInt(btn.dataset.index, 10);
      playTrackAt(card, album, index);
    };
    btn.addEventListener("click", play);
    btn.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        play(e);
      }
    });
  });
}

function renderCard(album){
  const cat = CATS[album.category];
  const card = document.createElement("div");
  card.className = "card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-pressed", "false");
  card.setAttribute("aria-label", `${album.title}, ${album.year}. Click to flip and view track list.`);

  const coverUrl = COVERS[album.title];
  const coverInner = coverUrl
    ? `<img class="cover-photo" src="${coverUrl}" alt="${escAttr(album.title)} cover" loading="lazy">`
    : `<div class="disc"></div>
       <div class="label">
         <div class="label-title">${initials(album.title)}</div>
         <div class="label-sub">RCA Victor</div>
       </div>
       <div class="spindle"></div>`;

  card.innerHTML = `
    <div class="card-inner">
      <div class="face face-front">
        <div class="cover">${coverInner}</div>
        <div class="info">
          <div class="title">${album.title}</div>
          <div class="meta-row">
            <div class="meta-left">
              <span class="year">${album.year}</span>
              <span class="cat-chip">${cat.label}</span>
            </div>
            <span class="flip-hint">${realTrackCount(album.tracklist)} tracks ⟳</span>
          </div>
        </div>
      </div>
      <div class="face face-back">
        <div class="back-head">
          <div class="title">${album.title}</div>
          <span class="year">${album.year} · ${realTrackCount(album.tracklist)} tracks</span>
        </div>
        <div class="back-body">
          <ol class="tracklist">${trackItemsHtml(album.title, album.tracklist)}</ol>
        </div>
      </div>
    </div>
  `;

  wirePlayButtons(card, album);

  const toggle = () => {
    const flipped = card.classList.toggle("flipped");
    card.setAttribute("aria-pressed", flipped ? "true" : "false");
    const restHeight = parseFloat(card.dataset.restHeight || 0);
    if (flipped) {
      const back = card.querySelector(".face-back");
      card.style.height = Math.max(restHeight, back.scrollHeight) + "px";
    } else {
      card.style.height = restHeight + "px";
    }
  };
  card.addEventListener("click", toggle);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });

  return card;
}

render();
