const channelLabel = document.getElementById("channelLabel");
const memberCount = document.getElementById("memberCount");
const speakingCount = document.getElementById("speakingCount");
const updatedAt = document.getElementById("updatedAt");
const memberList = document.getElementById("memberList");
const memberItemTemplate = document.getElementById("memberItemTemplate");
const settingsToggle = document.getElementById("settingsToggle");
const summaryTogglePanel = document.getElementById("summaryTogglePanel");
const settingsSection = document.querySelector('[data-section="settings"]');
const summarySection = document.querySelector('[data-section="summary"]');
const layoutSelect = document.getElementById("layoutSelect");
const backgroundColorInput = document.getElementById("backgroundColorInput");
const overlayGapInput = document.getElementById("overlayGapInput");
const overlayGapValue = document.getElementById("overlayGapValue");
const overlayNameToggle = document.getElementById("overlayNameToggle");
const overlayRingToggle = document.getElementById("overlayRingToggle");
const overlayRingWidthInput = document.getElementById("overlayRingWidthInput");
const overlayRingWidthValue = document.getElementById("overlayRingWidthValue");
const overlayStackSelect = document.getElementById("overlayStackSelect");
const selfPositionSelect = document.getElementById("selfPositionSelect");
const nameFontSelect = document.getElementById("nameFontSelect");
const dadAvatarToggle = document.getElementById("dadAvatarToggle");

const SUMMARY_VISIBILITY_KEY = "voice-monitor:summary-visible";
const SETTINGS_VISIBILITY_KEY = "voice-monitor:settings-visible";
const LAYOUT_KEY = "voice-monitor:layout";
const BACKGROUND_COLOR_KEY = "voice-monitor:background-color";
const OVERLAY_GAP_KEY = "voice-monitor:overlay-gap";
const OVERLAY_NAME_VISIBLE_KEY = "voice-monitor:overlay-name-visible";
const OVERLAY_RING_VISIBLE_KEY = "voice-monitor:overlay-ring-visible";
const OVERLAY_RING_WIDTH_KEY = "voice-monitor:overlay-ring-width";
const OVERLAY_STACK_ORDER_KEY = "voice-monitor:overlay-stack-order";
const SELF_POSITION_KEY = "voice-monitor:self-position";
const NAME_FONT_KEY = "voice-monitor:name-font";
const DAD_AVATAR_VISIBLE_KEY = "voice-monitor:dad-avatar-visible";

const TEXT = {
  notReceived: "\u672a\u53d7\u4fe1",
  notConnected: "VC \u672a\u63a5\u7d9a",
  noMembers: "\u73fe\u5728\u306e VC \u53c2\u52a0\u8005\u306f\u53d6\u5f97\u3067\u304d\u3066\u3044\u307e\u305b\u3093",
  waitingPlugin: "Discord plugin \u304b\u3089\u306e\u63a5\u7d9a\u3092\u5f85\u3063\u3066\u3044\u307e\u3059",
  settingsOn: "Settings ON",
  settingsOff: "Settings OFF",
  nameOn: "Name ON",
  nameOff: "Name OFF",
  ringOn: "Ring ON",
  ringOff: "Ring OFF",
  infoOn: "Info ON",
  infoOff: "Info OFF",
  avatarOn: "Avatar ON",
  avatarOff: "Avatar OFF"
};

const NAME_FONT_OPTIONS = {
  ui: '"Segoe UI", "Hiragino Sans", sans-serif',
  gothic: '"Yu Gothic", "Meiryo", sans-serif',
  rounded: '"Arial Rounded MT Bold", "Hiragino Maru Gothic ProN", "Meiryo", sans-serif',
  serif: '"Yu Mincho", "Hiragino Mincho ProN", Georgia, serif',
  mono: '"Cascadia Mono", "Consolas", monospace'
};

const memberOrder = new Map();
let nextMemberOrder = 0;
let latestSnapshot = {
  connected: false,
  channel: null,
  guildId: null,
  members: [],
  updatedAt: null
};

function normalizeHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#07111f";
}

function readLayout() {
  const saved = window.localStorage.getItem(LAYOUT_KEY);
  return saved === "overlay" || saved === "dad" ? saved : "default";
}

function readBackgroundColor() {
  return normalizeHexColor(window.localStorage.getItem(BACKGROUND_COLOR_KEY) || "#07111f");
}

function readOverlayGap() {
  const value = Number(window.localStorage.getItem(OVERLAY_GAP_KEY));
  if (Number.isFinite(value)) return Math.min(40, Math.max(-40, value));
  return 18;
}

function readOverlayNameVisible() {
  const saved = window.localStorage.getItem(OVERLAY_NAME_VISIBLE_KEY);
  return saved !== "false";
}

function readOverlayRingVisible() {
  const saved = window.localStorage.getItem(OVERLAY_RING_VISIBLE_KEY);
  return saved !== "false";
}

function readOverlayRingWidth() {
  const value = Number(window.localStorage.getItem(OVERLAY_RING_WIDTH_KEY));
  if (Number.isFinite(value)) return Math.min(18, Math.max(0, value));
  return 6;
}

function readOverlayStackOrder() {
  const saved = window.localStorage.getItem(OVERLAY_STACK_ORDER_KEY);
  return saved === "left-on-top" ? "left-on-top" : "right-on-top";
}

function readSelfPosition() {
  const saved = window.localStorage.getItem(SELF_POSITION_KEY);
  return saved === "left" || saved === "right" ? saved : "natural";
}

function readNameFont() {
  const saved = window.localStorage.getItem(NAME_FONT_KEY);
  return Object.hasOwn(NAME_FONT_OPTIONS, saved) ? saved : "ui";
}

function readDadAvatarVisible() {
  const saved = window.localStorage.getItem(DAD_AVATAR_VISIBLE_KEY);
  return saved !== "false";
}

function applyLayout(layout) {
  document.body.dataset.layout = layout;
  layoutSelect.value = layout;
}

function setLayout(layout) {
  window.localStorage.setItem(LAYOUT_KEY, layout);
  applyLayout(layout);
  rerenderCurrentSnapshot();
}

function applyOverlayGap(value) {
  const gap = Math.min(40, Math.max(-40, Number(value) || 0));
  document.documentElement.style.setProperty("--overlay-gap", `${gap}px`);
  overlayGapInput.value = String(gap);
  overlayGapValue.textContent = `${gap}px`;
}

function setOverlayGap(value) {
  const gap = Math.min(40, Math.max(-40, Number(value) || 0));
  window.localStorage.setItem(OVERLAY_GAP_KEY, String(gap));
  applyOverlayGap(gap);
}

function applyOverlayNameVisible(visible) {
  document.body.dataset.overlayNameVisible = visible ? "true" : "false";
  overlayNameToggle.textContent = visible ? TEXT.nameOn : TEXT.nameOff;
  overlayNameToggle.setAttribute("aria-pressed", String(visible));
}

function setOverlayNameVisible(visible) {
  window.localStorage.setItem(OVERLAY_NAME_VISIBLE_KEY, String(visible));
  applyOverlayNameVisible(visible);
}

function applyOverlayRingVisible(visible) {
  document.body.dataset.overlayRingVisible = visible ? "true" : "false";
  overlayRingToggle.textContent = visible ? TEXT.ringOn : TEXT.ringOff;
  overlayRingToggle.setAttribute("aria-pressed", String(visible));
}

function setOverlayRingVisible(visible) {
  window.localStorage.setItem(OVERLAY_RING_VISIBLE_KEY, String(visible));
  applyOverlayRingVisible(visible);
  rerenderCurrentSnapshot();
}

function applyOverlayRingWidth(value) {
  const width = Math.min(18, Math.max(0, Number(value) || 0));
  document.documentElement.style.setProperty("--overlay-ring-width", `${width}px`);
  overlayRingWidthInput.value = String(width);
  overlayRingWidthValue.textContent = `${width}px`;
}

function setOverlayRingWidth(value) {
  const width = Math.min(18, Math.max(0, Number(value) || 0));
  window.localStorage.setItem(OVERLAY_RING_WIDTH_KEY, String(width));
  applyOverlayRingWidth(width);
  rerenderCurrentSnapshot();
}

function applyOverlayStackOrder(order) {
  const normalized = order === "left-on-top" ? "left-on-top" : "right-on-top";
  document.body.dataset.overlayStackOrder = normalized;
  overlayStackSelect.value = normalized;
}

function setOverlayStackOrder(order) {
  const normalized = order === "left-on-top" ? "left-on-top" : "right-on-top";
  window.localStorage.setItem(OVERLAY_STACK_ORDER_KEY, normalized);
  applyOverlayStackOrder(normalized);
  rerenderCurrentSnapshot();
}

function applySelfPosition(position) {
  const normalized = position === "left" || position === "right" ? position : "natural";
  document.body.dataset.selfPosition = normalized;
  selfPositionSelect.value = normalized;
}

function setSelfPosition(position) {
  const normalized = position === "left" || position === "right" ? position : "natural";
  window.localStorage.setItem(SELF_POSITION_KEY, normalized);
  applySelfPosition(normalized);
  rerenderCurrentSnapshot();
}

function applyNameFont(fontKey) {
  const normalized = Object.hasOwn(NAME_FONT_OPTIONS, fontKey) ? fontKey : "ui";
  document.documentElement.style.setProperty("--name-font-family", NAME_FONT_OPTIONS[normalized]);
  nameFontSelect.value = normalized;
}

function setNameFont(fontKey) {
  const normalized = Object.hasOwn(NAME_FONT_OPTIONS, fontKey) ? fontKey : "ui";
  window.localStorage.setItem(NAME_FONT_KEY, normalized);
  applyNameFont(normalized);
  rerenderCurrentSnapshot();
}

function applyDadAvatarVisible(visible) {
  document.body.dataset.dadAvatarVisible = visible ? "true" : "false";
  dadAvatarToggle.textContent = visible ? TEXT.avatarOn : TEXT.avatarOff;
  dadAvatarToggle.setAttribute("aria-pressed", String(visible));
}

function setDadAvatarVisible(visible) {
  window.localStorage.setItem(DAD_AVATAR_VISIBLE_KEY, String(visible));
  applyDadAvatarVisible(visible);
}

function applyBackgroundColor(color) {
  const normalized = normalizeHexColor(color);
  document.documentElement.style.setProperty("--custom-bg-base", normalized);
  backgroundColorInput.value = normalized;
}

function setBackgroundColor(color) {
  const normalized = normalizeHexColor(color);
  window.localStorage.setItem(BACKGROUND_COLOR_KEY, normalized);
  applyBackgroundColor(normalized);
}

function readSummaryVisible() {
  const saved = window.localStorage.getItem(SUMMARY_VISIBILITY_KEY);
  return saved !== "false";
}

function readSettingsVisible() {
  const saved = window.localStorage.getItem(SETTINGS_VISIBILITY_KEY);
  return saved !== "false";
}

function syncSummaryToggleButtons(visible) {
  summaryTogglePanel.textContent = visible ? TEXT.infoOn : TEXT.infoOff;
  summaryTogglePanel.setAttribute("aria-pressed", String(visible));
}

function applySummaryVisibility(visible) {
  document.body.classList.toggle("summary-hidden", !visible);
  summarySection.hidden = !visible;
  syncSummaryToggleButtons(visible);
}

function setSummaryVisible(visible) {
  window.localStorage.setItem(SUMMARY_VISIBILITY_KEY, String(visible));
  applySummaryVisibility(visible);
}

function applySettingsVisibility(visible) {
  document.body.classList.toggle("settings-hidden", !visible);
  settingsSection.hidden = !visible;
  settingsToggle.textContent = visible ? TEXT.settingsOn : TEXT.settingsOff;
  settingsToggle.setAttribute("aria-pressed", String(visible));
}

function setSettingsVisible(visible) {
  window.localStorage.setItem(SETTINGS_VISIBILITY_KEY, String(visible));
  applySettingsVisibility(visible);
}

function formatTimestamp(value) {
  if (!value) return TEXT.notReceived;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? TEXT.notReceived : date.toLocaleTimeString("ja-JP");
}

function getStableMembers(snapshot) {
  const activeIds = new Set(snapshot.members.map(member => member.id));

  for (const member of snapshot.members) {
    if (!memberOrder.has(member.id)) {
      memberOrder.set(member.id, nextMemberOrder++);
    }
  }

  for (const id of Array.from(memberOrder.keys())) {
    if (!activeIds.has(id)) {
      memberOrder.delete(id);
    }
  }

  const ordered = [...snapshot.members].sort((left, right) => {
    return (memberOrder.get(left.id) ?? 0) - (memberOrder.get(right.id) ?? 0);
  });

  const selfPosition = document.body.dataset.selfPosition || "natural";
  if (selfPosition === "natural") return ordered;

  const selfIndex = ordered.findIndex(member => member.isSelf);
  if (selfIndex === -1) return ordered;

  const [selfMember] = ordered.splice(selfIndex, 1);
  if (selfPosition === "left") {
    ordered.unshift(selfMember);
  } else {
    ordered.push(selfMember);
  }

  return ordered;
}

function renderMembers(snapshot) {
  memberList.replaceChildren();

  if (!snapshot.members.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = snapshot.connected ? TEXT.noMembers : TEXT.waitingPlugin;
    memberList.appendChild(empty);
    return;
  }

  const stableMembers = getStableMembers(snapshot);

  for (const [index, member] of stableMembers.entries()) {
    const fragment = memberItemTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".member-card");
    const avatar = fragment.querySelector(".avatar");
    const dot = fragment.querySelector(".speaking-dot");
    const displayName = fragment.querySelector(".display-name");
    const secondaryLine = fragment.querySelector(".secondary-line");
    const statePill = fragment.querySelector(".state-pill");

    avatar.src = member.avatarUrl || "https://cdn.discordapp.com/embed/avatars/0.png";
    avatar.alt = `${member.displayName} avatar`;
    displayName.textContent = member.displayName;

    if (document.body.dataset.layout === "overlay") {
      const leftOnTop = document.body.dataset.overlayStackOrder === "left-on-top";
      const zIndex = leftOnTop ? stableMembers.length - index : index + 1;
      card.style.zIndex = String(zIndex);
    } else if (document.body.dataset.layout === "dad") {
      card.style.zIndex = member.speaking ? "2" : "1";
    } else {
      card.style.zIndex = "";
    }

    const details = [];
    if (member.username && member.username !== member.displayName) details.push(`@${member.username}`);
    if (member.isMuted) details.push("mute");
    if (member.isDeafened) details.push("deaf");
    secondaryLine.textContent = details.join(" / ");
    secondaryLine.hidden = details.length === 0;

    if (member.speaking) {
      dot.classList.add("active");
      card.classList.add("speaking");
      statePill.textContent = "Speaking";
      statePill.classList.add("is-speaking");
    } else {
      statePill.textContent = "Idle";
    }

    memberList.appendChild(fragment);
  }
}

function renderSnapshot(snapshot) {
  latestSnapshot = snapshot;
  const speakingMembers = snapshot.members.filter(member => member.speaking);

  channelLabel.textContent = snapshot.channel?.name
    ? `${snapshot.channel.name}${snapshot.channel.guildName ? ` / ${snapshot.channel.guildName}` : ""}`
    : TEXT.notConnected;

  memberCount.textContent = String(snapshot.members.length);
  speakingCount.textContent = String(speakingMembers.length);
  updatedAt.textContent = formatTimestamp(snapshot.updatedAt);

  renderMembers(snapshot);
}

function rerenderCurrentSnapshot() {
  renderSnapshot(latestSnapshot);
}

async function bootstrap() {
  applyLayout(readLayout());
  applyBackgroundColor(readBackgroundColor());
  applyOverlayGap(readOverlayGap());
  applyOverlayNameVisible(readOverlayNameVisible());
  applyOverlayRingVisible(readOverlayRingVisible());
  applyOverlayRingWidth(readOverlayRingWidth());
  applyOverlayStackOrder(readOverlayStackOrder());
  applySelfPosition(readSelfPosition());
  applyNameFont(readNameFont());
  applyDadAvatarVisible(readDadAvatarVisible());
  applySettingsVisibility(readSettingsVisible());
  applySummaryVisibility(readSummaryVisible());

  layoutSelect.addEventListener("change", event => {
    setLayout(event.target.value);
  });

  backgroundColorInput.addEventListener("input", event => {
    setBackgroundColor(event.target.value);
  });

  overlayGapInput.addEventListener("input", event => {
    setOverlayGap(event.target.value);
  });

  overlayNameToggle.addEventListener("click", () => {
    setOverlayNameVisible(document.body.dataset.overlayNameVisible !== "true");
  });

  overlayRingToggle.addEventListener("click", () => {
    setOverlayRingVisible(document.body.dataset.overlayRingVisible !== "true");
  });

  overlayRingWidthInput.addEventListener("input", event => {
    setOverlayRingWidth(event.target.value);
  });

  overlayStackSelect.addEventListener("change", event => {
    setOverlayStackOrder(event.target.value);
  });

  selfPositionSelect.addEventListener("change", event => {
    setSelfPosition(event.target.value);
  });

  nameFontSelect.addEventListener("change", event => {
    setNameFont(event.target.value);
  });

  dadAvatarToggle.addEventListener("click", () => {
    setDadAvatarVisible(document.body.dataset.dadAvatarVisible !== "true");
  });

  settingsToggle.addEventListener("click", () => {
    setSettingsVisible(settingsSection.hidden);
  });

  summaryTogglePanel.addEventListener("click", () => {
    setSummaryVisible(summarySection.hidden);
  });

  const initial = await window.voiceMonitor.getSnapshot();
  renderSnapshot(initial);
  window.voiceMonitor.onSnapshot(renderSnapshot);
}

bootstrap();
