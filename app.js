'use strict';

// =========================
// DOM selectors
// =========================
const dom = {
  form: document.querySelector('#calendarForm'),
  apiKey: document.querySelector('#apiKey'),
  calendarId: document.querySelector('#calendarId'),
  dateFrom: document.querySelector('#dateFrom'),
  dateTo: document.querySelector('#dateTo'),
  rememberSettings: document.querySelector('#rememberSettings'),
  loadBtn: document.querySelector('#loadBtn'),
  exportBtn: document.querySelector('#exportBtn'),
  clearStorageBtn: document.querySelector('#clearStorageBtn'),
  searchInput: document.querySelector('#searchInput'),
  loading: document.querySelector('#loading'),
  messageBox: document.querySelector('#messageBox'),
  totalEvents: document.querySelector('#totalEvents'),
  allDayEvents: document.querySelector('#allDayEvents'),
  timedEvents: document.querySelector('#timedEvents'),
  eventsTableBody: document.querySelector('#eventsTableBody'),
};

// =========================
// State
// =========================
const STORAGE_KEY = 'googleCalendarExporterSettings';
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const state = {
  rawEvents: [],
  normalizedEvents: [],
  filteredEvents: [],
};

// =========================
// Helpers
// =========================
function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function stripHTML(value) {
  const doc = new DOMParser().parseFromString(String(value ?? ''), 'text/html');
  return (doc.body.textContent || '').replace(/\u00a0/g, ' ').trim();
}

function truncateText(value, maxLength = 220) {
  const text = String(value ?? '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function getTodayDateString() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function addDaysToDateString(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDateVN(input) {
  if (!input) return '';

  // Input dạng yyyy-mm-dd của lịch cả ngày, tránh lệch ngày do timezone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month, day] = input.split('-');
    return `${day}/${month}/${year}`;
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatTimeVN(input) {
  if (!input || /^\d{4}-\d{2}-\d{2}$/.test(input)) return '';

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function normalizeStatus(status) {
  const map = {
    confirmed: 'Đã xác nhận',
    tentative: 'Tạm thời',
    cancelled: 'Đã hủy',
  };
  return map[status] || status || '';
}

function getInclusiveEndDateForAllDay(endDate) {
  if (!endDate) return '';
  return addDaysToDateString(endDate, -1);
}

function setLoading(isLoading) {
  dom.loading.classList.toggle('hidden', !isLoading);
  dom.loadBtn.disabled = isLoading;
  dom.loadBtn.textContent = isLoading ? 'Đang tải...' : 'Tải lịch';
}

function showMessage(message, type = 'info') {
  dom.messageBox.textContent = message;
  dom.messageBox.className = `message message-${type}`;
  dom.messageBox.classList.remove('hidden');
}

function hideMessage() {
  dom.messageBox.textContent = '';
  dom.messageBox.className = 'message hidden';
}

function resetEvents() {
  state.rawEvents = [];
  state.normalizedEvents = [];
  state.filteredEvents = [];
  dom.exportBtn.disabled = true;
  dom.searchInput.disabled = true;
  dom.searchInput.value = '';
  renderSummary([]);
  renderEventsTable([]);
}

function validateForm() {
  const apiKey = dom.apiKey.value.trim();
  const calendarId = dom.calendarId.value.trim();
  const dateFrom = dom.dateFrom.value;
  const dateTo = dom.dateTo.value;

  if (!apiKey) throw new Error('Thiếu API Key. Vui lòng nhập Google Calendar API Key.');
  if (!calendarId) throw new Error('Thiếu Calendar ID. Vui lòng nhập Calendar ID của lịch Google.');
  if (!dateFrom) throw new Error('Vui lòng chọn “Từ ngày”.');
  if (!dateTo) throw new Error('Vui lòng chọn “Đến ngày”.');
  if (dateFrom > dateTo) throw new Error('Khoảng ngày không hợp lệ. “Từ ngày” phải nhỏ hơn hoặc bằng “Đến ngày”.');

  return { apiKey, calendarId, dateFrom, dateTo };
}

function getGoogleApiErrorMessage(status, payload) {
  const apiMessage = payload?.error?.message || '';
  const reason = payload?.error?.errors?.[0]?.reason || '';

  if (status === 400) {
    return `Lỗi 400: Tham số gửi lên Google Calendar API chưa hợp lệ. ${apiMessage}`.trim();
  }

  if (status === 401) {
    return 'Lỗi 401: API Key không hợp lệ hoặc không được phép gọi API này.';
  }

  if (status === 403) {
    if (reason === 'dailyLimitExceeded' || reason === 'quotaExceeded') {
      return 'Lỗi 403: API Key đã hết quota hoặc bị giới hạn quota.';
    }
    if (reason === 'ipRefererBlocked' || reason === 'forbidden') {
      return 'Lỗi 403: API Key bị chặn theo domain/referrer, Calendar chưa public, hoặc chưa bật Google Calendar API.';
    }
    return `Lỗi 403: Calendar không public, API Key sai quyền, chưa bật Calendar API hoặc bị chặn quota. ${apiMessage}`.trim();
  }

  if (status === 404) {
    return 'Lỗi 404: Không tìm thấy Calendar ID. Hãy kiểm tra Calendar ID hoặc quyền public của lịch.';
  }

  return `Không tải được lịch hẹn. Mã lỗi ${status}. ${apiMessage}`.trim();
}

function saveSettingsIfNeeded(apiKey, calendarId) {
  if (!dom.rememberSettings.checked) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ apiKey, calendarId, remember: true }),
  );
}

function loadSavedSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved) return;

    dom.apiKey.value = saved.apiKey || '';
    dom.calendarId.value = saved.calendarId || '';
    dom.rememberSettings.checked = Boolean(saved.remember);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function clearSavedSettings() {
  localStorage.removeItem(STORAGE_KEY);
  dom.apiKey.value = '';
  dom.calendarId.value = '';
  dom.rememberSettings.checked = false;
  showMessage('Đã xóa API Key và Calendar ID đã lưu trên máy này.', 'success');
}

function getDefaultDateRange() {
  const today = getTodayDateString();
  return {
    from: today,
    to: addDaysToDateString(today, 30),
  };
}

// =========================
// API functions
// =========================
function buildCalendarApiUrl({ apiKey, calendarId, dateFrom, dateTo, pageToken = '' }) {
  const inclusiveTimeMin = `${dateFrom}T00:00:00+07:00`;
  const exclusiveTimeMax = `${addDaysToDateString(dateTo, 1)}T00:00:00+07:00`;

  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('timeMin', inclusiveTimeMin);
  url.searchParams.set('timeMax', exclusiveTimeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '2500');
  url.searchParams.set('timeZone', VIETNAM_TIME_ZONE);

  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }

  return url.toString();
}

async function fetchAllEvents(params) {
  const allEvents = [];
  let pageToken = '';

  do {
    const url = buildCalendarApiUrl({ ...params, pageToken });
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(getGoogleApiErrorMessage(response.status, payload));
    }

    allEvents.push(...(payload.items || []));
    pageToken = payload.nextPageToken || '';
  } while (pageToken);

  return allEvents;
}

// =========================
// Data normalization
// =========================
function normalizeEvent(event, index) {
  const isAllDay = Boolean(event?.start?.date);
  const startRaw = isAllDay ? event?.start?.date : event?.start?.dateTime;
  const endRaw = isAllDay ? event?.end?.date : event?.end?.dateTime;
  const endForDisplay = isAllDay ? getInclusiveEndDateForAllDay(endRaw) : endRaw;
  const cleanDescription = stripHTML(event?.description || '');

  return {
    stt: index + 1,
    id: event?.id || '',
    title: event?.summary || '(Không có tiêu đề)',
    startDate: formatDateVN(startRaw),
    startTime: isAllDay ? '' : formatTimeVN(startRaw),
    endDate: formatDateVN(endForDisplay),
    endTime: isAllDay ? '' : formatTimeVN(endRaw),
    isAllDay,
    isAllDayText: isAllDay ? 'Có' : 'Không',
    location: event?.location || '',
    description: cleanDescription,
    creatorName: event?.creator?.displayName || event?.organizer?.displayName || '',
    creatorEmail: event?.creator?.email || event?.organizer?.email || '',
    status: normalizeStatus(event?.status),
    rawStatus: event?.status || '',
    htmlLink: event?.htmlLink || '',
    searchText: [
      event?.summary || '',
      cleanDescription,
      event?.location || '',
      event?.creator?.displayName || '',
      event?.creator?.email || '',
    ].join(' ').toLowerCase(),
  };
}

function normalizeEvents(events) {
  return events.map(normalizeEvent);
}

function filterEvents(keyword) {
  const query = keyword.trim().toLowerCase();
  if (!query) return [...state.normalizedEvents];
  return state.normalizedEvents.filter((event) => event.searchText.includes(query));
}

// =========================
// Render functions
// =========================
function renderSummary(events) {
  const allDayCount = events.filter((event) => event.isAllDay).length;
  const timedCount = events.length - allDayCount;

  dom.totalEvents.textContent = String(events.length);
  dom.allDayEvents.textContent = String(allDayCount);
  dom.timedEvents.textContent = String(timedCount);
}

function renderEventsTable(events) {
  if (!events.length) {
    dom.eventsTableBody.innerHTML = '<tr><td colspan="12" class="empty-cell">Không có lịch hẹn nào để hiển thị.</td></tr>';
    return;
  }

  dom.eventsTableBody.innerHTML = events.map((event, index) => {
    const linkHTML = event.htmlLink
      ? `<a href="${escapeHTML(event.htmlLink)}" target="_blank" rel="noopener noreferrer">Mở lịch</a>`
      : '<span class="text-muted">Không có</span>';

    return `
      <tr>
        <td>${index + 1}</td>
        <td><span class="event-title">${escapeHTML(event.title)}</span></td>
        <td>${escapeHTML(event.startDate)}</td>
        <td>${escapeHTML(event.startTime || '-')}</td>
        <td>${escapeHTML(event.endDate)}</td>
        <td>${escapeHTML(event.endTime || '-')}</td>
        <td>${escapeHTML(event.isAllDayText)}</td>
        <td>${escapeHTML(event.location || '-')}</td>
        <td class="description-cell">${escapeHTML(truncateText(event.description || '-'))}</td>
        <td>${escapeHTML(event.creatorName || event.creatorEmail || '-')}</td>
        <td>${escapeHTML(event.status || '-')}</td>
        <td>${linkHTML}</td>
      </tr>
    `;
  }).join('');
}

function renderLoadedEvents(events) {
  state.filteredEvents = [...events];
  renderSummary(events);
  renderEventsTable(events);
  dom.exportBtn.disabled = events.length === 0;
  dom.searchInput.disabled = events.length === 0;
}

// =========================
// Excel export functions
// =========================
function getExcelRows(events) {
  return events.map((event, index) => ({
    STT: index + 1,
    'Tiêu đề lịch hẹn': event.title,
    'Ngày bắt đầu': event.startDate,
    'Giờ bắt đầu': event.startTime,
    'Ngày kết thúc': event.endDate,
    'Giờ kết thúc': event.endTime,
    'Cả ngày': event.isAllDayText,
    'Địa điểm': event.location,
    'Mô tả': event.description,
    'Người tạo': event.creatorName,
    'Email người tạo': event.creatorEmail,
    'Trạng thái': event.status,
    'Link Google Calendar': event.htmlLink,
  }));
}

function calculateColumnWidths(rows) {
  if (!rows.length) return [];

  const headers = Object.keys(rows[0]);
  return headers.map((header) => {
    const maxLength = rows.reduce((max, row) => {
      const value = String(row[header] ?? '');
      return Math.max(max, value.length);
    }, header.length);

    return { wch: Math.min(Math.max(maxLength + 2, 12), 60) };
  });
}

function exportToExcel() {
  if (!state.filteredEvents.length) {
    showMessage('Không có dữ liệu để xuất Excel.', 'error');
    return;
  }

  if (!window.XLSX) {
    showMessage('Không tải được thư viện SheetJS/xlsx. Vui lòng kiểm tra kết nối Internet rồi thử lại.', 'error');
    return;
  }

  const rows = getExcelRows(state.filteredEvents);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = calculateColumnWidths(rows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Lich hen');

  const filename = `google-calendar-export-${getTodayDateString()}.xlsx`;
  XLSX.writeFile(workbook, filename, { compression: true });
  showMessage(`Đã xuất ${rows.length} lịch hẹn ra file ${filename}.`, 'success');
}

// =========================
// Event listeners
// =========================
async function handleLoadEvents(event) {
  event.preventDefault();
  hideMessage();
  resetEvents();

  try {
    const formValues = validateForm();
    saveSettingsIfNeeded(formValues.apiKey, formValues.calendarId);

    setLoading(true);
    const rawEvents = await fetchAllEvents(formValues);

    if (!rawEvents.length) {
      showMessage('Không có lịch hẹn nào trong khoảng ngày đã chọn.', 'info');
      return;
    }

    state.rawEvents = rawEvents;
    state.normalizedEvents = normalizeEvents(rawEvents);
    renderLoadedEvents(state.normalizedEvents);
    showMessage(`Đã tải thành công ${state.normalizedEvents.length} lịch hẹn.`, 'success');
  } catch (error) {
    resetEvents();
    showMessage(error.message || 'Đã có lỗi xảy ra khi tải lịch.', 'error');
  } finally {
    setLoading(false);
  }
}

function handleSearch() {
  const filteredEvents = filterEvents(dom.searchInput.value);
  state.filteredEvents = filteredEvents;
  renderSummary(filteredEvents);
  renderEventsTable(filteredEvents);
  dom.exportBtn.disabled = filteredEvents.length === 0;
}

function init() {
  const defaultRange = getDefaultDateRange();
  dom.dateFrom.value = defaultRange.from;
  dom.dateTo.value = defaultRange.to;

  loadSavedSettings();
  renderSummary([]);

  dom.form.addEventListener('submit', handleLoadEvents);
  dom.exportBtn.addEventListener('click', exportToExcel);
  dom.clearStorageBtn.addEventListener('click', clearSavedSettings);
  dom.searchInput.addEventListener('input', handleSearch);
}

init();
