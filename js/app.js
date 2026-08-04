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
  const cols = Math.ceil((window.innerWidth + 60) / cell) + 1;
  const rows = Math.ceil((window.innerHeight + 60) / cell) + 1;
  const total = cols * rows;
  const shuffled = shuffle(urls);
  el.style.gridTemplateColumns = `repeat(${cols}, ${cell}px)`;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < total; i++){
    const img = document.createElement("img");
    img.src = shuffled[i % shuffled.length];
    img.alt = "";
    img.loading = i < cols * 2 ? "eager" : "lazy";
    frag.appendChild(img);
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

const qInput = document.getElementById("q");
qInput.addEventListener("input", render);

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

function parseYears(yearsStr){
  const parts = yearsStr.split(/[–-]/).map(s => parseInt(s.trim(), 10));
  const start = parts[0];
  const end = parts.length > 1 ? parts[1] : parts[0];
  const years = [];
  for (let y = start; y <= end; y++) years.push(y);
  return years;
}

function timelineHtml(yearsStr){
  const years = parseYears(yearsStr);
  const single = years.length === 1 ? " single" : "";
  const ticks = years.map(y => `<span class="tick">${y}</span>`).join("");
  return `<div class="era-timeline${single}">${ticks}</div>`;
}

function render(){
  const query = qInput.value.trim();
  const visible = new Set(ALBUMS.filter(a => matches(a, query, activeCat)));
  erasEl.innerHTML = "";

  countEl.textContent = visible.size === ALBUMS.length
    ? `${ALBUMS.length} albums`
    : `${visible.size} of ${ALBUMS.length} albums`;

  emptyEl.hidden = visible.size !== 0;

  const placed = new Set();

  ERAS.forEach(era => {
    const eraAlbums = era.albums
      .map(title => ALBUMS_BY_TITLE.get(title))
      .filter(album => visible.has(album) && !placed.has(album));
    if (eraAlbums.length === 0) return;
    eraAlbums.forEach(album => placed.add(album));

    const section = document.createElement("section");
    section.className = "era";
    const heading = era.years ? `${era.title} (${era.years})` : era.title;
    section.innerHTML = `
      <div class="era-head"><h2>${heading}</h2></div>
      ${era.years ? timelineHtml(era.years) : ""}
    `;
    const grid = document.createElement("div");
    grid.className = "grid";
    section.appendChild(grid);
    erasEl.appendChild(section);

    eraAlbums.forEach(album => {
      const card = renderCard(album);
      grid.appendChild(card);
      revealObserver.observe(card);
    });
  });

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
