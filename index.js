"use strict";

const SEAT_IDS = ["A1","A2","A3","A4","B1","B2","B3","B4","C1","C2","C3","C4"];
const STORAGE_KEY = "classroom-seat-manager-plus-v1";

let seats = loadSeats();
let activeFilter = "all";
let activeSort = "seat";
let searchTerm = "";
let toastTimer;

const grid = document.querySelector("#seat-grid");
const template = document.querySelector("#seat-template");
const emptyCount = document.querySelector("#empty-count");
const activeCount = document.querySelector("#active-count");
const totalMinutes = document.querySelector("#total-minutes");
const resetButton = document.querySelector("#reset-all");
const toast = document.querySelector("#toast");
const searchInput = document.querySelector("#user-search");
const clearSearchButton = document.querySelector("#clear-search");
const clearControlsButton = document.querySelector("#clear-controls");
const emptyResetButton = document.querySelector("#empty-reset");
const noResults = document.querySelector("#no-results");
const resultsCount = document.querySelector("#results-count");

function createInitialSeats() {
  return SEAT_IDS.map((id) => ({ id, status: "empty", user: "", minutes: 0 }));
}

function isValidSeatData(value) {
  if (!Array.isArray(value) || value.length !== SEAT_IDS.length) return false;
  return value.every((seat, index) => seat && seat.id === SEAT_IDS[index] &&
    ["empty", "active"].includes(seat.status) && typeof seat.user === "string" &&
    Number.isInteger(seat.minutes) && seat.minutes >= 0);
}

function loadSeats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return isValidSeatData(saved) ? saved : createInitialSeats();
  } catch {
    return createInitialSeats();
  }
}

function saveSeats() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(seats)); } catch { /* 앱은 저장 불가 환경에서도 작동 */ }
}

function getFocusState(minutes) {
  if (minutes >= 120) return { className: "needs-break", emoji: "🔥", label: "휴식 필요" };
  if (minutes >= 90) return { className: "fire-90", emoji: "🔥", label: "파이팅!" };
  if (minutes >= 60) return { className: "fire-60", emoji: "🔥", label: "집중 중" };
  if (minutes >= 30) return { className: "fire-30", emoji: "🔥", label: "시작이 좋아요" };
  return { className: "", emoji: "🌱", label: "새로운 집중을 기다려요" };
}

function getVisibleSeats() {
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("ko-KR");
  return seats
    .filter((seat) => !normalizedSearch || seat.id.toLocaleLowerCase("ko-KR").includes(normalizedSearch) ||
      (seat.status === "active" && seat.user.toLocaleLowerCase("ko-KR").includes(normalizedSearch)))
    .filter((seat) => activeFilter === "all" || activeFilter === "empty" && seat.status === "empty" || activeFilter === "active" && seat.status === "active" || activeFilter === "break" && seat.status === "active" && seat.minutes >= 120)
    .sort((a, b) => activeSort === "time" ? b.minutes - a.minutes || a.id.localeCompare(b.id) : a.id.localeCompare(b.id));
}

function render() {
  grid.replaceChildren();
  const visibleSeats = getVisibleSeats();
  visibleSeats.forEach((seat, index) => grid.append(createSeatCard(seat, index)));
  grid.hidden = visibleSeats.length === 0;
  noResults.hidden = visibleSeats.length !== 0;
  resultsCount.textContent = visibleSeats.length === seats.length ? `전체 ${seats.length}개 좌석` : `조건에 맞는 좌석 ${visibleSeats.length}개`;
  clearSearchButton.hidden = !searchTerm;
  updateSummary();
}

function createSeatCard(seat, index) {
  const card = template.content.firstElementChild.cloneNode(true);
  const isActive = seat.status === "active";
  const focus = getFocusState(seat.minutes);
  card.dataset.seatId = seat.id;
  card.style.animationDelay = `${Math.min(index * 35, 280)}ms`;
  card.classList.toggle("is-active", isActive);
  if (focus.className) card.classList.add(focus.className);
  card.querySelector(".seat-number").textContent = seat.id;
  card.querySelector(".status-badge").textContent = seat.minutes >= 120 ? "휴식 필요" : isActive ? "사용 중" : "비어 있음";
  card.querySelector(".character-emoji").textContent = focus.emoji;
  const info = card.querySelector(".seat-info");
  const actions = card.querySelector(".seat-actions");

  if (isActive) {
    const userLine = document.createElement("p");
    userLine.className = "user-line";
    userLine.textContent = seat.user;
    userLine.title = seat.user;
    const timeLine = document.createElement("p");
    timeLine.className = `time-line${seat.minutes >= 120 ? " break-copy" : ""}`;
    timeLine.textContent = `${seat.minutes}분 · ${focus.label}`;
    info.append(userLine, timeLine);
    actions.innerHTML = `<div class="active-buttons">
      <button class="action-button add-button" type="button" data-action="add" aria-label="${seat.id} 이용 시간 30분 추가">＋ 30분 추가</button>
      <button class="action-button end-button" type="button" data-action="end" aria-label="${seat.id} 사용 종료">사용 종료</button>
    </div>`;
  } else {
    const message = document.createElement("div");
    message.className = "empty-message";
    message.textContent = focus.label;
    info.append(message);
    actions.innerHTML = `<label class="name-label" for="name-${seat.id}">이용자 이름</label>
      <input class="name-input" id="name-${seat.id}" type="text" maxlength="20" autocomplete="off" placeholder="이름을 입력해 주세요" aria-describedby="error-${seat.id}">
      <span class="input-error" id="error-${seat.id}" aria-live="polite"></span>
      <button class="action-button start-button" type="button" data-action="start">🌈 사용 시작</button>`;
  }
  return card;
}

function updateSummary() {
  const active = seats.filter((seat) => seat.status === "active");
  emptyCount.textContent = seats.length - active.length;
  activeCount.textContent = active.length;
  totalMinutes.textContent = seats.reduce((sum, seat) => sum + seat.minutes, 0).toLocaleString("ko-KR");
}

function updateSeat(seatId, updates) {
  seats = seats.map((seat) => seat.id === seatId ? { ...seat, ...updates } : seat);
  saveSeats();
  render();
}

function startSeat(seatId, card) {
  const input = card.querySelector(".name-input");
  const error = card.querySelector(".input-error");
  const name = input.value.trim();
  if (!name) {
    input.classList.remove("has-error"); void input.offsetWidth; input.classList.add("has-error");
    error.textContent = "이름을 먼저 입력해 주세요!";
    input.setAttribute("aria-invalid", "true"); input.focus(); return;
  }
  updateSeat(seatId, { status: "active", user: name, minutes: 30 });
  showToast(`${seatId}에서 ${name}님의 집중이 시작됐어요! 🔥`);
}

function addTime(seatId) {
  const seat = seats.find((item) => item.id === seatId);
  const minutes = seat.minutes + 30;
  updateSeat(seatId, { minutes });
  showToast(minutes >= 120 ? `${seatId} · ${minutes}분! 잠깐 쉬어 가요 🧊` : `${seatId} · ${minutes}분 집중 중! 파이팅 🔥`);
}

function endSeat(seatId) {
  const seat = seats.find((item) => item.id === seatId);
  updateSeat(seatId, { status: "empty", user: "", minutes: 0 });
  showToast(`${seat.user}님의 ${seatId} 이용이 종료됐어요. 수고했어요! 👏`);
}

function resetControls() {
  searchTerm = ""; activeFilter = "all"; activeSort = "seat"; searchInput.value = "";
  document.querySelectorAll("[data-filter]").forEach((button) => setSelected(button, button.dataset.filter === "all"));
  document.querySelectorAll("[data-sort]").forEach((button) => setSelected(button, button.dataset.sort === "seat"));
  render();
}

function setSelected(button, selected) {
  button.classList.toggle("is-selected", selected);
  button.setAttribute("aria-pressed", String(selected));
}

function showToast(message) {
  clearTimeout(toastTimer); toast.textContent = message; toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

grid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]"); if (!button) return;
  const card = button.closest(".seat-card"); const seatId = card.dataset.seatId;
  if (button.dataset.action === "start") startSeat(seatId, card);
  if (button.dataset.action === "add") addTime(seatId);
  if (button.dataset.action === "end") endSeat(seatId);
});
grid.addEventListener("keydown", (event) => { if (event.key === "Enter" && event.target.matches(".name-input")) startSeat(event.target.closest(".seat-card").dataset.seatId, event.target.closest(".seat-card")); });
grid.addEventListener("input", (event) => { if (event.target.matches(".name-input")) { event.target.classList.remove("has-error"); event.target.removeAttribute("aria-invalid"); event.target.closest(".seat-actions").querySelector(".input-error").textContent = ""; } });
searchInput.addEventListener("input", () => { searchTerm = searchInput.value; render(); });
clearSearchButton.addEventListener("click", () => { searchTerm = ""; searchInput.value = ""; searchInput.focus(); render(); });
document.querySelector("#status-filters").addEventListener("click", (event) => { const button = event.target.closest("[data-filter]"); if (!button) return; activeFilter = button.dataset.filter; document.querySelectorAll("[data-filter]").forEach((item) => setSelected(item, item === button)); render(); });
document.querySelector("#sort-options").addEventListener("click", (event) => { const button = event.target.closest("[data-sort]"); if (!button) return; activeSort = button.dataset.sort; document.querySelectorAll("[data-sort]").forEach((item) => setSelected(item, item === button)); render(); });
clearControlsButton.addEventListener("click", resetControls);
emptyResetButton.addEventListener("click", resetControls);
resetButton.addEventListener("click", () => {
  if (seats.some((seat) => seat.status === "active") && !window.confirm("모든 좌석의 이용 정보를 처음 상태로 되돌릴까요?")) return;
  seats = createInitialSeats(); try { localStorage.removeItem(STORAGE_KEY); } catch { /* 무시 */ }
  resetControls(); showToast("모든 좌석을 처음 상태로 되돌렸어요 ✨");
});

render();
