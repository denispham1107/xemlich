'use strict';

// =========================
// DOM selectors
// =========================
const dom = {
  form: document.querySelector('#calendarForm'),
  apiKey: document.querySelector('#apiKey'),
  calendarId: document.querySelector('#calendarId'),
  mapsApiKey: document.querySelector('#mapsApiKey'),
  dateFrom: document.querySelector('#dateFrom'),
  dateTo: document.querySelector('#dateTo'),
  rememberSettings: document.querySelector('#rememberSettings'),
  rememberMapsSettings: document.querySelector('#rememberMapsSettings'),
  loadBtn: document.querySelector('#loadBtn'),
  calculateMapsBtn: document.querySelector('#calculateMapsBtn'),
  exportBtn: document.querySelector('#exportBtn'),
  clearStorageBtn: document.querySelector('#clearStorageBtn'),
  searchInput: document.querySelector('#searchInput'),
  calendarLoading: document.querySelector('#calendarLoading'),
  mapsLoading: document.querySelector('#mapsLoading'),
  mapsLoadingText: document.querySelector('#mapsLoadingText'),
  messageBox: document.querySelector('#messageBox'),
  totalEvents: document.querySelector('#totalEvents'),
  allDayEvents: document.querySelector('#allDayEvents'),
  timedEvents: document.querySelector('#timedEvents'),
  mapsCalculatedEvents: document.querySelector('#mapsCalculatedEvents'),
  eventsTableBody: document.querySelector('#eventsTableBody'),
};

// =========================
// State
// =========================
const STORAGE_KEY = 'googleCalendarExporterSettingsV2';
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const SHOP_ADDRESS = '129 Cù Lao, Phường Cầu Kiệu, Phú Nhuận, Thành phố Hồ Chí Minh, Việt Nam';
const MAPS_REQUEST_DELAY_MS = 220;

const state = {
  rawEvents: [],
  normalizedEvents: [],
  filteredEvents: [],
  mapsCache: new Map(),
  mapsScriptPromise: null,
  mapsScriptApiKey: '',
  directionsService: null,
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

function cleanText(value) {
  return stripHTML(value).replace(/\s+/g, ' ').trim();
}

function truncateText(value, maxLength = 220) {
  const text = String(value ?? '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

function setCalendarLoading(isLoading) {
  dom.calendarLoading.classList.toggle('hidden', !isLoading);
  dom.loadBtn.disabled = isLoading;
  dom.loadBtn.textContent = isLoading ? 'Đang tải...' : 'Tải lịch';
}

function setMapsLoading(isLoading, text = 'Đang tính thời gian di chuyển...') {
  dom.mapsLoading.classList.toggle('hidden', !isLoading);
  dom.mapsLoadingText.textContent = text;
  dom.calculateMapsBtn.disabled = isLoading || state.normalizedEvents.length === 0;
  dom.calculateMapsBtn.textContent = isLoading ? 'Đang tính...' : 'Tính thời gian di chuyển';
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
  state.mapsCache.clear();
  dom.exportBtn.disabled = true;
  dom.calculateMapsBtn.disabled = true;
  dom.searchInput.disabled = true;
  dom.searchInput.value = '';
  renderSummary([]);
  renderEventsTable([]);
}

function validateCalendarForm() {
  const apiKey = dom.apiKey.value.trim();
  const calendarId = dom.calendarId.value.trim();
  const dateFrom = dom.dateFrom.value;
  const dateTo = dom.dateTo.value;

  if (!apiKey) throw new Error('Thiếu Google Calendar API Key. Vui lòng nhập API Key.');
  if (!calendarId) throw new Error('Thiếu Calendar ID. Vui lòng nhập Calendar ID của lịch Google.');
  if (!dateFrom) throw new Error('Vui lòng chọn “Từ ngày”.');
  if (!dateTo) throw new Error('Vui lòng chọn “Đến ngày”.');
  if (dateFrom > dateTo) throw new Error('Khoảng ngày không hợp lệ. “Từ ngày” phải nhỏ hơn hoặc bằng “Đến ngày”.');

  return { apiKey, calendarId, dateFrom, dateTo };
}

function validateMapsApiKey() {
  const mapsApiKey = dom.mapsApiKey.value.trim();
  if (!mapsApiKey) {
    throw new Error('Thiếu Google Maps API Key. Vui lòng nhập API Key đã bật Maps JavaScript API.');
  }
  return mapsApiKey;
}

function getGoogleApiErrorMessage(status, payload) {
  const apiMessage = payload?.error?.message || '';
  const reason = payload?.error?.errors?.[0]?.reason || '';

  if (status === 400) {
    return `Lỗi 400: Tham số gửi lên Google Calendar API chưa hợp lệ. ${apiMessage}`.trim();
  }

  if (status === 401) {
    return 'Lỗi 401: API Key không hợp lệ hoặc không được phép gọi Google Calendar API.';
  }

  if (status === 403) {
    if (reason === 'dailyLimitExceeded' || reason === 'quotaExceeded') {
      return 'Lỗi 403: Google Calendar API Key đã hết quota hoặc bị giới hạn quota.';
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

function saveSettingsIfNeeded(apiKey, calendarId, mapsApiKey) {
  const payload = {
    apiKey: dom.rememberSettings.checked ? apiKey : '',
    calendarId: dom.rememberSettings.checked ? calendarId : '',
    rememberCalendar: Boolean(dom.rememberSettings.checked),
    mapsApiKey: dom.rememberMapsSettings.checked ? mapsApiKey : '',
    rememberMaps: Boolean(dom.rememberMapsSettings.checked),
  };

  if (!payload.rememberCalendar && !payload.rememberMaps) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadSavedSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved) return;

    dom.apiKey.value = saved.apiKey || '';
    dom.calendarId.value = saved.calendarId || '';
    dom.mapsApiKey.value = saved.mapsApiKey || '';
    dom.rememberSettings.checked = Boolean(saved.rememberCalendar);
    dom.rememberMapsSettings.checked = Boolean(saved.rememberMaps);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function clearSavedSettings() {
  localStorage.removeItem(STORAGE_KEY);
  dom.apiKey.value = '';
  dom.calendarId.value = '';
  dom.mapsApiKey.value = '';
  dom.rememberSettings.checked = false;
  dom.rememberMapsSettings.checked = false;
  showMessage('Đã xóa Calendar API Key, Calendar ID và Google Maps API Key đã lưu trên máy này.', 'success');
}

function getDefaultDateRange() {
  const today = getTodayDateString();
  return {
    from: today,
    to: addDaysToDateString(today, 30),
  };
}

function getMapsStatusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('đã tính')) return 'maps-ok';
  if (normalized.includes('lỗi') || normalized.includes('không') || normalized.includes('chưa nhận diện')) return 'maps-error';
  return 'maps-pending';
}

// =========================
// Calendar API functions
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
// Maps API functions
// =========================
function loadGoogleMapsScript(apiKey) {
  if (window.google?.maps?.DirectionsService) {
    return Promise.resolve(window.google.maps);
  }

  if (state.mapsScriptPromise) {
    if (state.mapsScriptApiKey && state.mapsScriptApiKey !== apiKey) {
      throw new Error('Google Maps script đã được tải bằng API Key khác. Hãy tải lại trang nếu muốn đổi Maps API Key.');
    }
    return state.mapsScriptPromise;
  }

  state.mapsScriptApiKey = apiKey;
  state.mapsScriptPromise = new Promise((resolve, reject) => {
    const previousAuthFailure = window.gm_authFailure;
    let settled = false;

    function finishWithError(message) {
      if (settled) return;
      settled = true;
      state.mapsScriptPromise = null;
      window.gm_authFailure = previousAuthFailure;
      reject(new Error(message));
    }

    window.gm_authFailure = () => {
      if (typeof previousAuthFailure === 'function') previousAuthFailure();
      finishWithError('Google Maps API Key sai, bị chặn domain/referrer, chưa bật Maps JavaScript API hoặc chưa bật billing.');
    };

    const script = document.createElement('script');
    const url = new URL('https://maps.googleapis.com/maps/api/js');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', 'vi');
    url.searchParams.set('region', 'VN');
    url.searchParams.set('v', 'weekly');

    script.src = url.toString();
    script.async = true;
    script.defer = true;

    script.onload = () => {
      window.setTimeout(() => {
        if (settled) return;
        if (window.google?.maps?.DirectionsService) {
          settled = true;
          window.gm_authFailure = previousAuthFailure;
          resolve(window.google.maps);
          return;
        }
        finishWithError('Maps không load được DirectionsService. Hãy kiểm tra Maps JavaScript API và API Key.');
      }, 50);
    };

    script.onerror = () => {
      finishWithError('Không tải được Google Maps JavaScript API. Hãy kiểm tra Internet, API Key và restrict domain.');
    };

    document.head.appendChild(script);
  });

  return state.mapsScriptPromise;
}

function extractCustomerAddress(summary, location) {
  const locationText = cleanText(location);
  if (locationText) return locationText;

  const title = cleanText(summary);
  if (!title) return '';

  const keywordMatch = title.match(/(?:địa\s*chỉ|dia\s*chi|address)\s*[:：-]\s*(.+)$/i);
  if (keywordMatch?.[1]) return cleanAddressCandidate(keywordMatch[1]);

  const delimiterParts = title.split(/\s+(?:-|\|)\s+/).map((part) => part.trim()).filter(Boolean);
  if (delimiterParts.length > 1) {
    return cleanAddressCandidate(delimiterParts[delimiterParts.length - 1]);
  }

  const numberAddressMatch = title.match(/\b\d{1,5}(?:[\/\-.]\d{1,5})*(?:\s*[A-Za-zÀ-ỹ0-9.'-]+){1,20}$/i);
  if (numberAddressMatch?.[0]) return cleanAddressCandidate(numberAddressMatch[0]);

  return '';
}

function cleanAddressCandidate(address) {
  return cleanText(address)
    .replace(/^[:：,\-\|\s]+/, '')
    .replace(/[.;,\s]+$/, '')
    .trim();
}

function normalizeAddress(address) {
  const cleaned = cleanAddressCandidate(address)
    .replace(/\bQ\s*(\d+)\b/gi, 'Quận $1')
    .replace(/\bP\s*(\d+)\b/gi, 'Phường $1')
    .replace(/\bTP\.?\s*HCM\b/gi, 'Thành phố Hồ Chí Minh')
    .replace(/\bHCM\b/gi, 'Thành phố Hồ Chí Minh')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';
  if (/việt\s*nam/i.test(cleaned)) return cleaned;
  if (/hồ\s*chí\s*minh|sài\s*gòn|tphcm|tp\.?\s*hcm/i.test(cleaned)) return `${cleaned}, Việt Nam`;
  return `${cleaned}, Thành phố Hồ Chí Minh, Việt Nam`;
}

function getDepartureTimeForEvent(event) {
  const now = new Date();
  if (!event?.startDateTimeRaw || event.isAllDay) return now;

  const eventStart = new Date(event.startDateTimeRaw);
  if (Number.isNaN(eventStart.getTime())) return now;
  return eventStart > now ? eventStart : now;
}

function getDirectionsService() {
  if (!state.directionsService) {
    state.directionsService = new google.maps.DirectionsService();
  }
  return state.directionsService;
}

function getBestDurationText(routeLeg) {
  return routeLeg?.duration_in_traffic?.text || routeLeg?.duration?.text || '';
}

function getMapsStatusMessage(status) {
  const map = {
    ZERO_RESULTS: 'Không tìm thấy đường đi',
    NOT_FOUND: 'Không tìm thấy địa chỉ khách',
    REQUEST_DENIED: 'REQUEST_DENIED: API key bị từ chối, chưa bật API, chưa bật billing hoặc bị chặn domain',
    OVER_QUERY_LIMIT: 'OVER_QUERY_LIMIT: Vượt quota hoặc gọi quá nhanh',
    INVALID_REQUEST: 'INVALID_REQUEST: Yêu cầu Maps không hợp lệ',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR: Google Maps lỗi tạm thời, hãy thử lại',
    MAX_WAYPOINTS_EXCEEDED: 'Vượt giới hạn điểm dừng',
    MAX_ROUTE_LENGTH_EXCEEDED: 'Tuyến đường quá dài',
  };
  return map[status] || `Google Maps không tính được đường đi (${status || 'UNKNOWN'}).`;
}

async function calculateRoute(origin, destination, departureTime) {
  const directionsService = getDirectionsService();
  const request = {
    origin,
    destination,
    travelMode: google.maps.TravelMode.DRIVING,
    drivingOptions: {
      departureTime,
      trafficModel: google.maps.TrafficModel.BEST_GUESS,
    },
    provideRouteAlternatives: false,
  };

  return new Promise((resolve) => {
    directionsService.route(request, (result, status) => {
      if (status !== google.maps.DirectionsStatus.OK || !result?.routes?.[0]?.legs?.[0]) {
        resolve({ ok: false, status, error: getMapsStatusMessage(status) });
        return;
      }

      const leg = result.routes[0].legs[0];
      resolve({
        ok: true,
        status,
        durationText: getBestDurationText(leg),
        distanceText: leg.distance?.text || '',
      });
    });
  });
}

function hasValidMapsResult(event) {
  return Boolean(
    event?.mapsStatus === 'Đã tính xong'
    && event.routeToCustomerText
    && event.routeBackToShopText,
  );
}

function applyCachedMapsResult(event, cached) {
  event.routeToCustomerText = cached.routeToCustomerText || '';
  event.routeToCustomerDistanceText = cached.routeToCustomerDistanceText || '';
  event.routeBackToShopText = cached.routeBackToShopText || '';
  event.routeBackToShopDistanceText = cached.routeBackToShopDistanceText || '';
  event.mapsStatus = cached.mapsStatus || '';
  event.mapsError = cached.mapsError || '';
}

async function calculateTravelTimesForEvent(event) {
  if (!event.customerAddress) {
    event.mapsStatus = 'Chưa nhận diện địa chỉ';
    event.mapsError = 'Không tìm thấy địa chỉ trong location hoặc tiêu đề lịch hẹn.';
    return event;
  }

  if (hasValidMapsResult(event)) return event;

  const cacheKey = normalizeAddress(event.customerAddress).toLowerCase();
  if (!cacheKey) {
    event.mapsStatus = 'Chưa nhận diện địa chỉ';
    event.mapsError = 'Địa chỉ khách trống hoặc không hợp lệ.';
    return event;
  }

  if (state.mapsCache.has(cacheKey)) {
    applyCachedMapsResult(event, state.mapsCache.get(cacheKey));
    return event;
  }

  const departureTime = getDepartureTimeForEvent(event);
  const toCustomer = await calculateRoute(SHOP_ADDRESS, cacheKey, departureTime);
  await sleep(MAPS_REQUEST_DELAY_MS);
  const backToShop = await calculateRoute(cacheKey, SHOP_ADDRESS, departureTime);

  event.routeToCustomerText = toCustomer.ok ? toCustomer.durationText : 'Không tính được';
  event.routeToCustomerDistanceText = toCustomer.ok ? toCustomer.distanceText : '';
  event.routeBackToShopText = backToShop.ok ? backToShop.durationText : 'Không tính được';
  event.routeBackToShopDistanceText = backToShop.ok ? backToShop.distanceText : '';

  const errors = [toCustomer, backToShop]
    .filter((result) => !result.ok)
    .map((result) => result.error)
    .filter(Boolean);

  event.mapsStatus = errors.length ? 'Lỗi một phần hoặc toàn bộ' : 'Đã tính xong';
  event.mapsError = errors.join(' | ');

  state.mapsCache.set(cacheKey, {
    routeToCustomerText: event.routeToCustomerText,
    routeToCustomerDistanceText: event.routeToCustomerDistanceText,
    routeBackToShopText: event.routeBackToShopText,
    routeBackToShopDistanceText: event.routeBackToShopDistanceText,
    mapsStatus: event.mapsStatus,
    mapsError: event.mapsError,
  });

  return event;
}

async function calculateTravelTimesForAllEvents() {
  if (!state.normalizedEvents.length) {
    throw new Error('Chưa có dữ liệu lịch hẹn để tính thời gian di chuyển.');
  }

  const mapsApiKey = validateMapsApiKey();
  saveSettingsIfNeeded(dom.apiKey.value.trim(), dom.calendarId.value.trim(), mapsApiKey);
  await loadGoogleMapsScript(mapsApiKey);

  const targets = state.normalizedEvents.filter((event) => !hasValidMapsResult(event));
  if (!targets.length) {
    showMessage('Tất cả lịch hẹn đã có kết quả Maps hợp lệ, không cần tính lại.', 'info');
    return;
  }

  for (let index = 0; index < targets.length; index += 1) {
    const event = targets[index];
    setMapsLoading(true, `Đang tính thời gian di chuyển... (${index + 1}/${targets.length})`);
    event.mapsStatus = event.customerAddress ? 'Đang tính...' : 'Chưa nhận diện địa chỉ';
    renderLoadedEvents(state.filteredEvents.length ? state.filteredEvents : state.normalizedEvents, { preserveFilter: true });

    try {
      await calculateTravelTimesForEvent(event);
    } catch (error) {
      event.mapsStatus = 'Lỗi Maps';
      event.mapsError = error.message || 'Không tính được thời gian di chuyển.';
    }

    handleSearch({ silent: true });
    await sleep(MAPS_REQUEST_DELAY_MS);
  }
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
  const customerAddress = extractCustomerAddress(event?.summary || '', event?.location || '');
  const mapsStatus = customerAddress ? 'Chưa tính' : 'Chưa nhận diện địa chỉ';

  return {
    stt: index + 1,
    id: event?.id || '',
    title: event?.summary || '(Không có tiêu đề)',
    startDate: formatDateVN(startRaw),
    startTime: isAllDay ? '' : formatTimeVN(startRaw),
    endDate: formatDateVN(endForDisplay),
    endTime: isAllDay ? '' : formatTimeVN(endRaw),
    startDateTimeRaw: isAllDay ? '' : event?.start?.dateTime || '',
    isAllDay,
    isAllDayText: isAllDay ? 'Có' : 'Không',
    location: event?.location || '',
    customerAddress,
    routeToCustomerText: '',
    routeToCustomerDistanceText: '',
    routeBackToShopText: '',
    routeBackToShopDistanceText: '',
    mapsStatus,
    mapsError: customerAddress ? '' : 'Không tìm thấy địa chỉ trong location hoặc tiêu đề lịch hẹn.',
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
      customerAddress,
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
  const mapsCalculatedCount = events.filter((event) => hasValidMapsResult(event)).length;

  dom.totalEvents.textContent = String(events.length);
  dom.allDayEvents.textContent = String(allDayCount);
  dom.timedEvents.textContent = String(timedCount);
  dom.mapsCalculatedEvents.textContent = String(mapsCalculatedCount);
}

function renderEventsTable(events) {
  if (!events.length) {
    dom.eventsTableBody.innerHTML = '<tr><td colspan="18" class="empty-cell">Không có lịch hẹn nào để hiển thị.</td></tr>';
    return;
  }

  dom.eventsTableBody.innerHTML = events.map((event, index) => {
    const linkHTML = event.htmlLink
      ? `<a href="${escapeHTML(event.htmlLink)}" target="_blank" rel="noopener noreferrer">Mở lịch</a>`
      : '<span class="text-muted">Không có</span>';

    const mapsStatusHTML = `
      <span class="${getMapsStatusClass(event.mapsStatus)}">${escapeHTML(event.mapsStatus || '-')}</span>
      ${event.mapsError ? `<br><small class="text-muted">${escapeHTML(truncateText(event.mapsError, 180))}</small>` : ''}
    `;

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
        <td class="address-cell">${escapeHTML(event.customerAddress || 'Chưa nhận diện địa chỉ')}</td>
        <td>${escapeHTML(event.routeToCustomerText || '-')}</td>
        <td>${escapeHTML(event.routeToCustomerDistanceText || '-')}</td>
        <td>${escapeHTML(event.routeBackToShopText || '-')}</td>
        <td>${escapeHTML(event.routeBackToShopDistanceText || '-')}</td>
        <td class="maps-status-cell">${mapsStatusHTML}</td>
        <td class="description-cell">${escapeHTML(truncateText(event.description || '-'))}</td>
        <td>${escapeHTML(event.creatorName || event.creatorEmail || '-')}</td>
        <td>${escapeHTML(event.status || '-')}</td>
        <td>${linkHTML}</td>
      </tr>
    `;
  }).join('');
}

function renderLoadedEvents(events, options = {}) {
  if (!options.preserveFilter) {
    state.filteredEvents = [...events];
  }

  renderSummary(events);
  renderEventsTable(events);
  dom.exportBtn.disabled = events.length === 0;
  dom.calculateMapsBtn.disabled = state.normalizedEvents.length === 0;
  dom.searchInput.disabled = state.normalizedEvents.length === 0;
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
    'Địa chỉ khách': event.customerAddress,
    'Thời gian Shop → Khách': event.routeToCustomerText,
    'Quãng đường Shop → Khách': event.routeToCustomerDistanceText,
    'Thời gian Khách → Shop': event.routeBackToShopText,
    'Quãng đường Khách → Shop': event.routeBackToShopDistanceText,
    'Trạng thái Maps': event.mapsStatus,
    'Lỗi Maps nếu có': event.mapsError,
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
    const formValues = validateCalendarForm();
    saveSettingsIfNeeded(formValues.apiKey, formValues.calendarId, dom.mapsApiKey.value.trim());

    setCalendarLoading(true);
    const rawEvents = await fetchAllEvents(formValues);

    if (!rawEvents.length) {
      showMessage('Không có lịch hẹn nào trong khoảng ngày đã chọn.', 'info');
      return;
    }

    state.rawEvents = rawEvents;
    state.normalizedEvents = normalizeEvents(rawEvents);
    renderLoadedEvents(state.normalizedEvents);
    showMessage(`Đã tải thành công ${state.normalizedEvents.length} lịch hẹn. Bạn có thể bấm “Tính thời gian di chuyển”.`, 'success');
  } catch (error) {
    resetEvents();
    showMessage(error.message || 'Đã có lỗi xảy ra khi tải lịch.', 'error');
  } finally {
    setCalendarLoading(false);
  }
}

function handleSearch(options = {}) {
  const filteredEvents = filterEvents(dom.searchInput.value);
  state.filteredEvents = filteredEvents;
  renderSummary(filteredEvents);
  renderEventsTable(filteredEvents);
  dom.exportBtn.disabled = filteredEvents.length === 0;

  if (!options.silent && filteredEvents.length === 0 && state.normalizedEvents.length > 0) {
    showMessage('Không có lịch hẹn nào khớp với từ khóa tìm kiếm.', 'info');
  }
}

async function handleCalculateMaps() {
  hideMessage();

  try {
    setMapsLoading(true);
    await calculateTravelTimesForAllEvents();
    handleSearch({ silent: true });
    showMessage('Đã tính xong thời gian di chuyển cho các lịch hẹn có địa chỉ nhận diện được.', 'success');
  } catch (error) {
    showMessage(error.message || 'Đã có lỗi xảy ra khi tính Google Maps.', 'error');
  } finally {
    setMapsLoading(false);
  }
}

function init() {
  const defaultRange = getDefaultDateRange();
  dom.dateFrom.value = defaultRange.from;
  dom.dateTo.value = defaultRange.to;

  loadSavedSettings();
  renderSummary([]);

  dom.form.addEventListener('submit', handleLoadEvents);
  dom.calculateMapsBtn.addEventListener('click', handleCalculateMaps);
  dom.exportBtn.addEventListener('click', exportToExcel);
  dom.clearStorageBtn.addEventListener('click', clearSavedSettings);
  dom.searchInput.addEventListener('input', () => handleSearch());
}

init();
