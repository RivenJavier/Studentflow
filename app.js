(function () {
  const PROFILE_KEY = 'studentflow_profiles';
  const ACTIVE_PROFILE_KEY = 'studentflow_active_profile';
  const DARK_MODE_KEY = 'studentflow_dark_mode';
  const EMERGENCY_ADMIN_URL = 'https://rider-emergency-id.raydori242020.workers.dev/admin';
  const FREE_LIMITS = {
    classes: 3,
    goals: 3,
    assignments: 3,
  };
  const CURRENCIES = {
    USD: 'US Dollar ($)',
    EUR: 'Euro (€)',
    GBP: 'British Pound (£)',
    PHP: 'Philippine Peso (₱)',
    JPY: 'Japanese Yen (¥)',
    INR: 'Indian Rupee (₹)',
    CAD: 'Canadian Dollar (CA$)',
    AUD: 'Australian Dollar (A$)',
  };
  const authTabs = document.querySelectorAll('.auth-tab');
  const authForms = document.querySelectorAll('.auth-form');
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');

  const state = {
    profile: null,
    goals: [],
    assignments: [],
    allowance: [],
    classes: [],
    emergencyStickers: [],
    playlists: [],
    pomodoro: {
      workMinutes: 25,
      breakMinutes: 5,
      isRunning: false,
      mode: 'work',
      remainingSeconds: 25 * 60,
      timerId: null,
    },
    currentView: 'profile',
    activeTool: null,
  };

  function safeParse(value, fallback) {
    try {
      return value === null || value === undefined ? fallback : JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function formatClock(totalSeconds) {
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function loadPomodoroSettings() {
    const saved = safeParse(localStorage.getItem('studentflow_pomodoro'), null);
    if (!saved) return;

    state.pomodoro.workMinutes = Number(saved.workMinutes) || 25;
    state.pomodoro.breakMinutes = Number(saved.breakMinutes) || 5;
    state.pomodoro.mode = saved.mode === 'break' ? 'break' : 'work';
    state.pomodoro.remainingSeconds = Number(saved.remainingSeconds) || state.pomodoro.workMinutes * 60;
  }

  function savePomodoroSettings() {
    localStorage.setItem(
      'studentflow_pomodoro',
      JSON.stringify({
        workMinutes: state.pomodoro.workMinutes,
        breakMinutes: state.pomodoro.breakMinutes,
        mode: state.pomodoro.mode,
        remainingSeconds: state.pomodoro.remainingSeconds,
      })
    );
  }

  function getDefaultPlaylists() {
    return [
      { id: 1, title: 'Deep Focus', url: 'https://www.youtube.com/results?search_query=study+music+focus' },
      { id: 2, title: 'Lo-fi Flow', url: 'https://www.youtube.com/results?search_query=lofi+study+music' },
    ];
  }

  function loadPlaylists() {
    const saved = safeParse(localStorage.getItem('studentflow_playlists'), null);
    state.playlists = Array.isArray(saved) && saved.length ? saved : getDefaultPlaylists();
  }

  function savePlaylists() {
    localStorage.setItem('studentflow_playlists', JSON.stringify(state.playlists));
  }

  function getProfiles() {
    return safeParse(localStorage.getItem(PROFILE_KEY), {});
  }

  function saveProfiles(profiles) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
  }

  function getCurrencyCode() {
    return CURRENCIES[state.profile?.currency] ? state.profile.currency : 'USD';
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: getCurrencyCode(),
    }).format(Number(amount) || 0);
  }

  function isPremium() {
    return state.profile?.premium === true;
  }

  function showPremiumPrompt() {
    alert('This feature is part of the Premium package. Upgrade from Settings to unlock it.');
    setActiveView('settings');
  }

  function canAddItem(collection, label) {
    if (isPremium() || state[collection].length < FREE_LIMITS[collection]) {
      return true;
    }

    alert(`Free accounts can have up to ${FREE_LIMITS[collection]} ${label}. Upgrade to Premium for unlimited ${label}.`);
    setActiveView('settings');
    return false;
  }

  function renderPremiumStatus() {
    const status = document.getElementById('premiumStatus');
    const upgradeButton = document.getElementById('upgradePremiumButton');
    if (!status || !upgradeButton) return;

    status.textContent = isPremium() ? 'Premium active' : 'Free plan';
    status.classList.toggle('premium-active', isPremium());
    upgradeButton.textContent = isPremium() ? 'Premium activated' : 'Activate Premium (demo)';
    upgradeButton.disabled = isPremium();
  }

  function profileBucket(prefix, schoolId) {
    return `${prefix}_${schoolId || 'guest'}`;
  }

  function makeAvatar(name) {
    const initials = name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#7d8eff"/>
            <stop offset="100%" stop-color="#6cc7ff"/>
          </linearGradient>
        </defs>
        <rect width="160" height="160" rx="80" fill="#eef3ff"/>
        <circle cx="80" cy="58" r="34" fill="url(#g)"/>
        <path d="M34 136c8-24 28-36 46-36s38 12 46 36" fill="url(#g)"/>
        <text x="80" y="146" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#ffffff" font-weight="700">${initials || 'ST'}</text>
      </svg>
    `;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function getStoredDarkMode() {
    return localStorage.getItem(DARK_MODE_KEY) === 'true';
  }

  function applyTheme(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) {
      toggle.checked = isDark;
    }
    localStorage.setItem(DARK_MODE_KEY, String(isDark));
  }

  function setAuthTab(tabName) {
    authTabs.forEach((tab) => {
      const isActive = tab.dataset.auth === tabName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    authForms.forEach((form) => {
      const isActive = form.id === `${tabName}Form`;
      form.classList.toggle('active-form', isActive);
      form.hidden = !isActive;
    });
  }

  function setActiveView(viewName) {
    state.currentView = viewName;

    navItems.forEach((item) => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    viewPanels.forEach((panel) => {
      panel.classList.toggle('active', panel.id === `view-${viewName}`);
    });
  }

  function showAuthShell() {
    document.getElementById('authShell').classList.remove('hidden');
    document.getElementById('dashboardShell').classList.add('hidden');
    document.getElementById('toolScreen').classList.add('hidden');
    state.profile = null;
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
  }

  function showDashboard() {
    document.getElementById('authShell').classList.add('hidden');
    document.getElementById('dashboardShell').classList.remove('hidden');
    document.getElementById('toolScreen').classList.add('hidden');
    setActiveView(state.currentView || 'profile');
  }

  function loadProfileData() {
    if (!state.profile) {
      state.goals = [];
      state.assignments = [];
      state.allowance = [];
      state.classes = [];
      return;
    }

    const schoolId = state.profile.schoolId;
    state.goals = safeParse(localStorage.getItem(profileBucket('studentflow_goals', schoolId)), [
      { id: 1, title: 'Finish biology revision', note: 'Review chapter 5 and flashcards', progress: 75 },
      { id: 2, title: 'Complete math practice set', note: 'Work through the weekend worksheet', progress: 40 },
    ]);
    state.assignments = safeParse(localStorage.getItem(profileBucket('studentflow_assignments', schoolId)), [
      { id: 1, title: 'History essay draft', date: '2026-10-14', status: 'in progress' },
      { id: 2, title: 'Chemistry lab report', date: '2026-10-18', status: 'done' },
      { id: 3, title: 'Spanish speaking task', date: '2026-10-20', status: 'planning' },
    ]).map((assignment) => ({
      ...assignment,
      status: normalizeAssignmentStatus(assignment.status),
    }));
    state.allowance = safeParse(localStorage.getItem(profileBucket('studentflow_allowance', schoolId)), [
      { id: 1, label: 'Allowance', amount: 90, type: 'income' },
      { id: 2, label: 'Lunch', amount: -18, type: 'expense' },
      { id: 3, label: 'Transport', amount: -14, type: 'expense' },
      { id: 4, label: 'Tutoring', amount: 15, type: 'income' },
    ]);
    state.classes = safeParse(localStorage.getItem(profileBucket('studentflow_classes', schoolId)), [
      { id: 1, name: 'Biology', professor: 'Dr. Singh', days: ['Mon', 'Wed'], time: '09:00' },
      { id: 2, name: 'Mathematics', professor: 'Mrs. Clarke', days: ['Tue', 'Thu'], time: '11:00' },
      { id: 3, name: 'Literature', professor: 'Ms. Alvarez', days: ['Fri'], time: '13:00' },
    ]).map((item) => ({
      ...item,
      days: normalizeClassDays(Array.isArray(item.days) ? item.days : getClassDays(item)),
      time: item.time || '09:00',
    }));
    state.emergencyStickers = safeParse(localStorage.getItem(profileBucket('studentflow_emergency_stickers', schoolId)), []);
  }

  function saveProfileData() {
    if (!state.profile) {
      return;
    }

    localStorage.setItem(profileBucket('studentflow_goals', state.profile.schoolId), JSON.stringify(state.goals));
    localStorage.setItem(profileBucket('studentflow_assignments', state.profile.schoolId), JSON.stringify(state.assignments));
    localStorage.setItem(profileBucket('studentflow_allowance', state.profile.schoolId), JSON.stringify(state.allowance));
    localStorage.setItem(profileBucket('studentflow_classes', state.profile.schoolId), JSON.stringify(state.classes));
    localStorage.setItem(profileBucket('studentflow_emergency_stickers', state.profile.schoolId), JSON.stringify(state.emergencyStickers));
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function normalizeClassDays(days = []) {
    const valid = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const input = Array.isArray(days) ? days : [];
    const normalized = input
      .map((day) => String(day).trim())
      .filter((day) => valid.includes(day));

    return [...new Set(normalized)];
  }

  function parseClassTime(rawTime = '') {
    if (!rawTime) {
      return 24 * 60;
    }

    const [hours, minutes = '0'] = String(rawTime).split(':');
    return Number(hours) * 60 + Number(minutes);
  }

  function getClassDays(item = {}) {
    if (Array.isArray(item.days) && item.days.length) {
      return normalizeClassDays(item.days);
    }

    if (typeof item.day === 'string' && item.day) {
      return normalizeClassDays([item.day]);
    }

    const text = `${item.time || ''} ${item.day || ''}`.trim();
    const matches = text.match(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/gi) || [];
    return normalizeClassDays(matches.map((day) => day.charAt(0).toUpperCase() + day.slice(1).toLowerCase()));
  }

  function normalizeAssignmentStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'ready' || normalized === 'done') return 'done';
    if (normalized === 'planned' || normalized === 'planning') return 'planning';
    if (normalized === 'in progress' || normalized === 'in-progress') return 'in progress';
    return 'in progress';
  }

  function formatAssignmentStatus(status) {
    const normalized = normalizeAssignmentStatus(status);
    if (normalized === 'done') return 'Done';
    if (normalized === 'planning') return 'Planning';
    return 'In progress';
  }

  function getTodayClasses(items = []) {
    const todayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date());

    return [...items]
      .filter((item) => {
        const days = getClassDays(item);
        return days.length ? days.includes(todayName) : true;
      })
      .sort((a, b) => parseClassTime(a.time) - parseClassTime(b.time))
      .reverse();
  }

  function renderProfileMetrics() {
    const goalsTotal = state.goals.length;
    const completedGoals = state.goals.filter((goal) => Number(goal.progress) >= 100).length;
    const activeAssignments = state.assignments.filter((assignment) => {
      const status = normalizeAssignmentStatus(assignment.status);
      return status === 'in progress' || status === 'planning';
    }).length;

    const goalsCompletedValue = document.getElementById('goalsCompletedValue');
    const goalsCompletedMeta = document.getElementById('goalsCompletedMeta');
    const assignmentsDueValue = document.getElementById('assignmentsDueValue');
    const assignmentsDueMeta = document.getElementById('assignmentsDueMeta');
    const budgetLeftValue = document.getElementById('budgetLeftValue');
    const budgetLeftMeta = document.getElementById('budgetLeftMeta');

    if (goalsCompletedValue) {
      goalsCompletedValue.textContent = goalsTotal ? `${completedGoals}/${goalsTotal}` : '0/0';
    }
    if (goalsCompletedMeta) {
      goalsCompletedMeta.textContent = goalsTotal ? `${completedGoals} completed` : 'No goals yet';
    }

    if (assignmentsDueValue) {
      assignmentsDueValue.textContent = String(activeAssignments);
    }
    if (assignmentsDueMeta) {
      assignmentsDueMeta.textContent = activeAssignments ? `${activeAssignments} due` : 'No due items';
    }

    const { remaining } = getAllowanceTotals();
    if (budgetLeftValue) {
      budgetLeftValue.textContent = formatCurrency(remaining);
    }
    if (budgetLeftMeta) {
      budgetLeftMeta.textContent = state.allowance.length ? 'Updated this week' : 'No entries';
    }
  }

  function renderClasses() {
    const profileList = document.getElementById('classList');
    const classesList = document.getElementById('classesList');
    const todayClasses = getTodayClasses(state.classes);

    if (profileList) {
      profileList.innerHTML = todayClasses.length
        ? todayClasses
            .map(
              (item) => `
                <li>
                  <div class="class-meta">
                    <strong>${item.name}</strong>
                    <small>${item.professor}</small>
                  </div>
                  <span>${item.time}</span>
                </li>
              `
            )
            .join('')
        : '<li class="empty-state">No classes today.</li>';
    }

    if (classesList) {
      const sortedClasses = [...state.classes]
        .sort((a, b) => parseClassTime(a.time).minutes - parseClassTime(b.time).minutes)
        .reverse();

      classesList.innerHTML = sortedClasses.length
        ? sortedClasses
            .map(
              (item) => `
                <li class="class-entry-item" data-class-id="${item.id}">
                  <div class="class-entry-copy">
                    <strong>${item.name}</strong>
                    <small>${item.professor}</small>
                    <span>${item.days.join(', ')} · ${item.time}</span>
                  </div>
                  <div class="goal-actions">
                    <button class="inline-action action-toggle" type="button" data-edit-class="${item.id}">Edit</button>
                    <button class="inline-action delete action-toggle" type="button" data-delete-class="${item.id}">Delete</button>
                  </div>
                </li>
              `
            )
            .join('')
        : '<li class="empty-state">No classes added yet. Add your first class below.</li>';

      classesList.querySelectorAll('[data-edit-class]').forEach((button) => {
        button.addEventListener('click', () => {
          const classItem = state.classes.find((item) => Number(item.id) === Number(button.dataset.editClass));
          if (!classItem) return;
          const classForm = document.getElementById('classForm');
          classForm.dataset.editingId = String(classItem.id);
          document.getElementById('className').value = classItem.name;
          document.getElementById('classProfessor').value = classItem.professor;
          document.getElementById('classTime').value = classItem.time;

          document.querySelectorAll('input[name="classDay"]').forEach((checkbox) => {
            checkbox.checked = (classItem.days || []).includes(checkbox.value);
          });
        });
      });

      classesList.querySelectorAll('[data-delete-class]').forEach((button) => {
        button.addEventListener('click', () => {
          const classId = Number(button.dataset.deleteClass);
          state.classes = state.classes.filter((item) => Number(item.id) !== classId);
          saveProfileData();
          renderClasses();
          renderProfileSummary();
        });
      });
    }

    const classForm = document.getElementById('classForm');
    const classSettingsButton = document.querySelector('[data-settings="view-classes"]');
    if (classSettingsButton) {
      classSettingsButton.onclick = () => {
        if (!classForm) return;
        const shouldShow = classForm.classList.contains('hidden');
        classForm.classList.toggle('hidden', !shouldShow);
        classForm.style.display = shouldShow ? 'block' : 'none';
        document.querySelectorAll('#classesList .action-toggle').forEach((el) => {
          el.classList.toggle('visible', shouldShow);
        });
      };
    }
  }

  function renderProfileSummary() {
    const profile = state.profile;
    if (!profile) {
      return;
    }

    const navAvatar = document.getElementById('navAvatar');
    const profileImage = document.getElementById('profileImage');
    const profileName = document.getElementById('profileName');
    const greetingName = document.getElementById('greetingName');
    const navName = document.getElementById('navName');
    const profileAge = document.getElementById('profileAge');
    const profileSchoolId = document.getElementById('profileSchoolId');
    const navId = document.getElementById('navId');
    const profileGradeChip = document.getElementById('profileGradeChip');

    const avatar = profile.avatar || makeAvatar(profile.fullName || 'Student');
    navAvatar.src = avatar;
    profileImage.src = avatar;
    navAvatar.alt = `${profile.fullName} avatar`;
    profileImage.alt = `${profile.fullName} profile`;
    profileName.textContent = profile.fullName || 'Student Name';
    greetingName.textContent = profile.fullName ? profile.fullName.split(' ')[0] : 'Student';
    navName.textContent = profile.fullName || 'Student';
    navId.textContent = `ID: ${profile.schoolId || '--'}`;
    profileAge.textContent = profile.age || '--';
    profileSchoolId.textContent = profile.schoolId || '--';
    profileGradeChip.textContent = profile.grade ? `Course/Year ${profile.grade}` : 'Course/Year --';

    const settingsFullName = document.getElementById('settingsFullName');
    const settingsSchoolId = document.getElementById('settingsSchoolId');
    const settingsAge = document.getElementById('settingsAge');
    const settingsGrade = document.getElementById('settingsGrade');
    const settingsPassword = document.getElementById('settingsPassword');
    const settingsAvatarPreview = document.getElementById('settingsAvatarPreview');
    if (settingsFullName) settingsFullName.value = profile.fullName || '';
    if (settingsSchoolId) settingsSchoolId.value = profile.schoolId || '';
    if (settingsAge) settingsAge.value = profile.age || '';
    if (settingsGrade) settingsGrade.value = profile.grade || '';
    if (settingsPassword) settingsPassword.value = '';
    if (settingsAvatarPreview) settingsAvatarPreview.src = avatar;

    const currencySelect = document.getElementById('currencySelect');
    if (currencySelect) currencySelect.value = getCurrencyCode();

    renderProfileMetrics();
    renderClasses();
    renderEmergencyStickers();
    renderPremiumStatus();
  }

  function renderEmergencyStickers() {
    const list = document.getElementById('emergencyStickersList');
    if (!list) return;

    const settingsButton = document.querySelector('[data-settings="view-emergency-stickers"]');
    const form = document.getElementById('emergencyStickerForm');
    if (!isPremium()) {
      list.innerHTML = '<div class="premium-lock-state"><strong>Premium feature</strong><span>Emergency Stickers are included with Premium, along with a physical RFID card.</span><button class="small-btn primary" type="button" data-open-premium>View Premium</button></div>';
      form?.classList.add('hidden');
      if (form) form.style.display = 'none';
      if (settingsButton) {
        settingsButton.onclick = showPremiumPrompt;
      }
      list.querySelector('[data-open-premium]')?.addEventListener('click', showPremiumPrompt);
      return;
    }

    bindSectionSettingsToggle('[data-settings="view-emergency-stickers"]', 'emergencyStickerForm', '#emergencyStickersList .action-toggle');

    if (!state.emergencyStickers.length) {
      list.innerHTML = '<div class="empty-state">No emergency stickers yet. Create one below.</div>';
      return;
    }

    list.innerHTML = state.emergencyStickers
      .map(
        (sticker) => `
          <div class="emergency-sticker-card" data-emergency-id="${sticker.id}">
            <button class="emergency-sticker-button" type="button" data-open-sticker="${sticker.id}">
              <div class="emergency-qr-box">
                ${sticker.qrImage ? `<img src="${sticker.qrImage}" alt="${sticker.title || 'Emergency profile'} QR code" />` : '<div class="emergency-qr-placeholder">No QR</div>'}
              </div>
              <div class="emergency-sticker-copy">
                <strong>${sticker.title || 'Emergency profile'}</strong>
                <span>Tap to open</span>
              </div>
            </button>
            ${
              sticker.qrImage
                ? ''
                : `<button class="emergency-create-link" type="button" data-emergency-admin="${EMERGENCY_ADMIN_URL}">Doesn’t have QR yet? Create one now!</button>`
            }
            <button class="inline-action delete action-toggle emergency-delete" type="button" data-delete-sticker="${sticker.id}">Remove</button>
          </div>
        `
      )
      .join('');

    list.querySelectorAll('[data-open-sticker]').forEach((button) => {
      button.addEventListener('click', () => {
        const stickerId = Number(button.dataset.openSticker);
        const sticker = state.emergencyStickers.find((entry) => Number(entry.id) === stickerId);
        const targetUrl = sticker?.url || EMERGENCY_ADMIN_URL;
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      });
    });

    list.querySelectorAll('[data-emergency-admin]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        window.open(button.dataset.emergencyAdmin || EMERGENCY_ADMIN_URL, '_blank', 'noopener,noreferrer');
      });
    });

    list.querySelectorAll('[data-delete-sticker]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const stickerId = Number(button.dataset.deleteSticker);
        state.emergencyStickers = state.emergencyStickers.filter((entry) => Number(entry.id) !== stickerId);
        saveProfileData();
        renderEmergencyStickers();
      });
    });

  }

  function bindEmergencyStickerForm() {
    const form = document.getElementById('emergencyStickerForm');
    const qrInput = document.getElementById('emergencyStickerQrInput');
    const qrPreview = document.getElementById('emergencyStickerPreview');
    const qrPreviewWrap = document.getElementById('emergencyStickerPreviewWrap');
    const createLink = qrPreviewWrap?.querySelector('[data-emergency-admin]');

    if (qrInput && qrPreview) {
      qrInput.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
          qrPreview.src = String(reader.result || '');
          qrPreview.style.display = 'block';
          if (createLink) createLink.style.display = 'none';
        };
        reader.readAsDataURL(file);
      });
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      if (!isPremium()) {
        showPremiumPrompt();
        return;
      }

      const title = document.getElementById('emergencyStickerTitle').value.trim() || 'Emergency profile';
      const url = document.getElementById('emergencyStickerUrl').value.trim();
      const qrImage = qrPreview.src && qrPreview.src !== window.location.href ? qrPreview.src : '';

      if (!url) return;

      state.emergencyStickers.push({
        id: Date.now() + Math.random(),
        title,
        url,
        qrImage,
      });

      saveProfileData();
      form.reset();
      document.getElementById('emergencyStickerTitle').value = 'Emergency profile';
      qrPreview.src = '';
      qrPreview.style.display = 'none';
      if (createLink) createLink.style.display = 'block';
      renderEmergencyStickers();
    });

    document.getElementById('cancelEmergencyStickerEdit').addEventListener('click', () => {
      form.reset();
      document.getElementById('emergencyStickerTitle').value = 'Emergency profile';
      qrPreview.src = '';
      qrPreview.style.display = 'none';
      if (createLink) createLink.style.display = 'block';
    });

    if (createLink) {
      createLink.addEventListener('click', (event) => {
        event.stopPropagation();
        window.open(createLink.dataset.emergencyAdmin || EMERGENCY_ADMIN_URL, '_blank', 'noopener,noreferrer');
      });
    }
  }

  function bindSectionSettingsToggle(settingsSelector, formId, itemSelector) {
    const settingsButton = document.querySelector(settingsSelector);
    const form = document.getElementById(formId);
    if (!settingsButton || !form) return;

    const syncSectionState = () => {
      const shouldShow = !form.classList.contains('hidden');
      form.style.display = shouldShow ? '' : 'none';
      document.querySelectorAll(itemSelector).forEach((el) => {
        el.classList.toggle('visible', shouldShow);
      });
    };

    settingsButton.onclick = () => {
      const shouldShow = form.classList.contains('hidden');
      form.classList.toggle('hidden', !shouldShow);
      form.reset?.();
      form.removeAttribute('data-editing-id');
      syncSectionState();
    };

    syncSectionState();
  }

  function resetGoalArchiveState() {
    const archiveSection = document.getElementById('goalArchiveSection');
    const archiveToggle = document.getElementById('toggleGoalArchive');
    const archiveList = document.getElementById('goalArchiveList');

    if (archiveToggle) {
      archiveToggle.textContent = 'View archive';
      archiveToggle.classList.remove('active');
      archiveToggle.style.display = 'inline-flex';
    }

    if (archiveSection) {
      archiveSection.hidden = true;
    }

    if (archiveList) {
      archiveList.innerHTML = '<div class="empty-state">No completed goals yet.</div>';
    }
  }

  function toggleGoalArchive(forceState) {
    const toggle = document.getElementById('toggleGoalArchive');
    const section = document.getElementById('goalArchiveSection');
    if (!toggle || !section) return;

    const hasArchivedItems = state.goals.some((goal) => Number(goal.progress) >= 100);
    if (!hasArchivedItems) {
      resetGoalArchiveState();
      return;
    }

    const shouldShow = typeof forceState === 'boolean' ? forceState : section.hidden;
    section.hidden = !shouldShow;
    toggle.textContent = shouldShow ? 'Hide archive' : 'View archive';
    toggle.classList.toggle('active', shouldShow);
  }

  function syncGoalArchiveUI(archivedGoals) {
    const archiveSection = document.getElementById('goalArchiveSection');
    const archiveToggle = document.getElementById('toggleGoalArchive');
    const hasArchivedItems = archivedGoals.length > 0;

    if (archiveToggle) {
      archiveToggle.style.display = 'inline-flex';
      archiveToggle.textContent = 'View archive';
      archiveToggle.classList.remove('active');
    }

    if (archiveSection) {
      archiveSection.hidden = true;
    }
  }

  function renderGoals() {
    const goalsList = document.getElementById('goalsList');
    const archiveList = document.getElementById('goalArchiveList');
    const archiveSection = document.getElementById('goalArchiveSection');
    const archiveToggle = document.getElementById('toggleGoalArchive');
    if (!goalsList) return;

    const activeGoals = state.goals.filter((goal) => Number(goal.progress) < 100);
    const archivedGoals = state.goals.filter((goal) => Number(goal.progress) >= 100);

    if (!archivedGoals.length) {
      resetGoalArchiveState();
    } else {
      syncGoalArchiveUI(archivedGoals);
    }

    if (!activeGoals.length) {
      goalsList.innerHTML = '<div class="empty-state">No active goals. Add your next study target.</div>';
    } else {
      goalsList.innerHTML = activeGoals
        .map(
          (goal) => `
            <div class="goal-item" data-goal-id="${goal.id}">
              <div class="goal-tab-header" data-open-goal="${goal.id}">
                <div class="goal-info">
                  <h4>${goal.title}</h4>
                  <p class="goal-note-preview">${goal.note}</p>
                </div>
                <div class="goal-actions">
                  <button class="inline-action action-toggle" type="button" data-edit-goal="${goal.id}">Edit</button>
                  <button class="inline-action delete action-toggle" type="button" data-delete-goal="${goal.id}">Delete</button>
                </div>
              </div>
              <div class="goal-detail">
                <div class="goal-detail-copy">
                  <span class="goal-detail-label">Notes</span>
                  <p>${goal.note}</p>
                </div>
              </div>
              <div class="progress">
                <span style="width: ${Math.min(100, Math.max(0, goal.progress || 0))}%"></span>
              </div>
              <div class="range-value-wrap">
                <span>Progress</span>
                <strong>${Math.round(goal.progress || 0)}%</strong>
              </div>
            </div>
          `
        )
        .join('');
    }

    if (archiveList) {
      if (!archivedGoals.length) {
        archiveList.innerHTML = '<div class="empty-state">No completed goals yet.</div>';
      } else {
        archiveList.innerHTML = archivedGoals
          .map(
            (goal) => `
              <div class="goal-item archive-item" data-goal-id="${goal.id}">
                <div class="goal-tab-header" data-open-goal="${goal.id}">
                  <div class="goal-info">
                    <h4>${goal.title}</h4>
                    <p class="goal-note-preview">${goal.note}</p>
                  </div>
                  <div class="goal-actions">
                    <button class="inline-action action-toggle" type="button" data-edit-goal="${goal.id}">Edit</button>
                    <button class="inline-action delete action-toggle" type="button" data-delete-goal="${goal.id}">Delete</button>
                  </div>
                </div>
                <div class="goal-detail">
                  <div class="goal-detail-copy">
                    <span class="goal-detail-label">Notes</span>
                    <p>${goal.note}</p>
                  </div>
                </div>
                <div class="progress">
                  <span style="width: 100%"></span>
                </div>
                <div class="range-value-wrap">
                  <span>Progress</span>
                  <strong>100%</strong>
                </div>
              </div>
            `
          )
          .join('');
      }
    }

    const syncGoalStatusButtons = (value) => {
      const progress = Number(value) || 0;
      document.querySelectorAll('.progress-status').forEach((button) => {
        const matches = Number(button.dataset.progress) === progress;
        button.classList.toggle('active', matches);
      });
    };

    goalsList.querySelectorAll('[data-open-goal]').forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const goalId = Number(trigger.dataset.openGoal);
        const goal = state.goals.find((item) => Number(item.id) === goalId);
        if (!goal) return;

        document.getElementById('goalTitle').value = goal.title;
        document.getElementById('goalNote').value = goal.note;
        document.getElementById('goalProgress').value = goal.progress;
        document.getElementById('goalProgressValue').textContent = `${Math.round(goal.progress)}%`;
        syncGoalStatusButtons(goal.progress);
        document.getElementById('goalForm').dataset.editingId = String(goal.id);

        const goalCard = trigger.closest('.goal-item');
        goalCard.classList.toggle('expanded');
        goalCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });

    archiveList?.querySelectorAll('[data-open-goal]').forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const goalId = Number(trigger.dataset.openGoal);
        const goal = state.goals.find((item) => Number(item.id) === goalId);
        if (!goal) return;

        document.getElementById('goalTitle').value = goal.title;
        document.getElementById('goalNote').value = goal.note;
        document.getElementById('goalProgress').value = goal.progress;
        document.getElementById('goalProgressValue').textContent = `${Math.round(goal.progress)}%`;
        syncGoalStatusButtons(goal.progress);
        document.getElementById('goalForm').dataset.editingId = String(goal.id);
        document.getElementById('goalForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    goalsList.querySelectorAll('[data-edit-goal]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const goal = state.goals.find((item) => Number(item.id) === Number(button.dataset.editGoal));
        if (!goal) return;
        document.getElementById('goalTitle').value = goal.title;
        document.getElementById('goalNote').value = goal.note;
        document.getElementById('goalProgress').value = goal.progress;
        document.getElementById('goalProgressValue').textContent = `${Math.round(goal.progress)}%`;
        syncGoalStatusButtons(goal.progress);
        document.getElementById('goalForm').dataset.editingId = String(goal.id);
        document.getElementById('goalForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    archiveList?.querySelectorAll('[data-edit-goal]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const goal = state.goals.find((item) => Number(item.id) === Number(button.dataset.editGoal));
        if (!goal) return;
        document.getElementById('goalTitle').value = goal.title;
        document.getElementById('goalNote').value = goal.note;
        document.getElementById('goalProgress').value = goal.progress;
        document.getElementById('goalProgressValue').textContent = `${Math.round(goal.progress)}%`;
        syncGoalStatusButtons(goal.progress);
        document.getElementById('goalForm').dataset.editingId = String(goal.id);
        document.getElementById('goalForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    goalsList.querySelectorAll('[data-delete-goal]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const goalId = Number(button.dataset.deleteGoal);
        state.goals = state.goals.filter((goal) => Number(goal.id) !== goalId);
        saveProfileData();
        renderGoals();
        renderProfileSummary();
      });
    });

    archiveList?.querySelectorAll('[data-delete-goal]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const goalId = Number(button.dataset.deleteGoal);
        state.goals = state.goals.filter((goal) => Number(goal.id) !== goalId);
        saveProfileData();
        renderGoals();
        renderProfileSummary();
      });
    });

    if (archiveToggle) {
      archiveToggle.onclick = () => {
        const section = document.getElementById('goalArchiveSection');
        if (!section) return;
        toggleGoalArchive(section.hidden);
      };
    }

    bindSectionSettingsToggle('[data-settings="view-goals"]', 'goalForm', '#goalsList .action-toggle, #goalArchiveList .action-toggle');
  }

  function resetAssignmentArchiveState() {
    const archiveSection = document.getElementById('assignmentArchiveSection');
    const archiveToggle = document.getElementById('toggleAssignmentArchive');
    const archiveList = document.getElementById('assignmentArchiveList');

    if (archiveToggle) {
      archiveToggle.textContent = 'View archive';
      archiveToggle.classList.remove('active');
      archiveToggle.style.display = 'inline-flex';
    }

    if (archiveSection) {
      archiveSection.hidden = true;
    }

    if (archiveList) {
      archiveList.innerHTML = '<li class="empty-state">No completed assignments yet.</li>';
    }
  }

  function toggleAssignmentArchive(forceState) {
    const toggle = document.getElementById('toggleAssignmentArchive');
    const section = document.getElementById('assignmentArchiveSection');
    if (!toggle || !section) return;

    const hasArchivedItems = state.assignments.some((assignment) => normalizeAssignmentStatus(assignment.status) === 'done');
    if (!hasArchivedItems) {
      resetAssignmentArchiveState();
      return;
    }

    const shouldShow = typeof forceState === 'boolean' ? forceState : section.hidden;
    section.hidden = !shouldShow;
    toggle.textContent = shouldShow ? 'Hide archive' : 'View archive';
    toggle.classList.toggle('active', shouldShow);
  }

  function syncAssignmentArchiveUI(archivedAssignments) {
    const archiveSection = document.getElementById('assignmentArchiveSection');
    const archiveToggle = document.getElementById('toggleAssignmentArchive');
    const hasArchivedItems = archivedAssignments.length > 0;

    if (archiveToggle) {
      archiveToggle.style.display = 'inline-flex';
      archiveToggle.textContent = 'View archive';
      archiveToggle.classList.remove('active');
    }

    if (archiveSection) {
      archiveSection.hidden = true;
    }
  }

  function renderAssignments() {
    const assignmentsList = document.getElementById('assignmentsList');
    const archiveList = document.getElementById('assignmentArchiveList');
    const archiveSection = document.getElementById('assignmentArchiveSection');
    const archiveToggle = document.getElementById('toggleAssignmentArchive');
    if (!assignmentsList) return;

    const activeAssignments = state.assignments.filter((assignment) => normalizeAssignmentStatus(assignment.status) !== 'done');
    const archivedAssignments = state.assignments.filter((assignment) => normalizeAssignmentStatus(assignment.status) === 'done');

    if (!archivedAssignments.length) {
      resetAssignmentArchiveState();
    } else {
      syncAssignmentArchiveUI(archivedAssignments);
    }

    if (archiveToggle && !archivedAssignments.length) {
      archiveToggle.textContent = 'View archive';
      archiveToggle.classList.remove('active');
      if (archiveSection) {
        archiveSection.hidden = true;
      }
    }

    if (!activeAssignments.length) {
      assignmentsList.innerHTML = '<li class="empty-state">No active assignments. Add a new one below.</li>';
    } else {
      assignmentsList.innerHTML = activeAssignments
        .map(
          (assignment) => `
            <li class="assignment-item" data-assignment-id="${assignment.id}">
              <div class="assignment-tab-header" data-open-assignment="${assignment.id}">
                <div>
                  <strong>${assignment.title}</strong>
                  <p class="assignment-date">${assignment.date}</p>
                </div>
                <div class="item-actions">
                  <span class="status ${normalizeAssignmentStatus(assignment.status) === 'done' ? 'green' : normalizeAssignmentStatus(assignment.status) === 'planning' ? 'blue' : 'yellow'}">${formatAssignmentStatus(assignment.status)}</span>
                  <button class="inline-action action-toggle" type="button" data-edit-assignment="${assignment.id}">Edit</button>
                  <button class="inline-action delete action-toggle" type="button" data-delete-assignment="${assignment.id}">Delete</button>
                </div>
              </div>
              <div class="assignment-detail">
                <div class="assignment-detail-copy">
                  <span class="goal-detail-label">Assignment</span>
                  <p>${assignment.title}</p>
                </div>
              </div>
            </li>
          `
        )
        .join('');
    }

    if (archiveList) {
      if (!archivedAssignments.length) {
        archiveList.innerHTML = '<li class="empty-state">No completed assignments yet.</li>';
      } else {
        archiveList.innerHTML = archivedAssignments
          .map(
            (assignment) => `
              <li class="assignment-item archive-item" data-assignment-id="${assignment.id}">
                <div class="assignment-tab-header" data-open-assignment="${assignment.id}">
                  <div>
                    <strong>${assignment.title}</strong>
                    <p class="assignment-date">${assignment.date}</p>
                  </div>
                  <div class="item-actions">
                    <span class="status green">Done</span>
                    <button class="inline-action action-toggle" type="button" data-edit-assignment="${assignment.id}">Edit</button>
                    <button class="inline-action delete action-toggle" type="button" data-delete-assignment="${assignment.id}">Delete</button>
                  </div>
                </div>
              </li>
            `
          )
          .join('');
      }
    }

    assignmentsList.querySelectorAll('[data-open-assignment]').forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const assignmentId = Number(trigger.dataset.openAssignment);
        const assignment = state.assignments.find((item) => Number(item.id) === assignmentId);
        if (!assignment) return;

        document.getElementById('assignmentTitle').value = assignment.title;
        document.getElementById('assignmentDate').value = assignment.date;
        document.getElementById('assignmentStatus').value = normalizeAssignmentStatus(assignment.status);
        document.getElementById('assignmentForm').dataset.editingId = String(assignment.id);

        const item = trigger.closest('.assignment-item');
        item.classList.toggle('expanded');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });

    archiveList?.querySelectorAll('[data-open-assignment]').forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const assignmentId = Number(trigger.dataset.openAssignment);
        const assignment = state.assignments.find((item) => Number(item.id) === assignmentId);
        if (!assignment) return;

        document.getElementById('assignmentTitle').value = assignment.title;
        document.getElementById('assignmentDate').value = assignment.date;
        document.getElementById('assignmentStatus').value = normalizeAssignmentStatus(assignment.status);
        document.getElementById('assignmentForm').dataset.editingId = String(assignment.id);
        document.getElementById('assignmentForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    document.querySelectorAll('[data-edit-assignment]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const id = Number(button.dataset.editAssignment);
        const assignment = state.assignments.find((item) => Number(item.id) === id);
        if (!assignment) return;
        document.getElementById('assignmentTitle').value = assignment.title;
        document.getElementById('assignmentDate').value = assignment.date;
        document.getElementById('assignmentStatus').value = normalizeAssignmentStatus(assignment.status);
        document.getElementById('assignmentForm').dataset.editingId = String(assignment.id);
        document.getElementById('assignmentForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    document.querySelectorAll('[data-delete-assignment]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const id = Number(button.dataset.deleteAssignment);
        const assignmentForm = document.getElementById('assignmentForm');

        state.assignments = state.assignments.filter((item) => Number(item.id) !== id);
        if (assignmentForm) {
          assignmentForm.reset();
          assignmentForm.removeAttribute('data-editing-id');
        }

        if (!state.assignments.some((item) => normalizeAssignmentStatus(item.status) === 'done')) {
          resetAssignmentArchiveState();
        }

        saveProfileData();
        renderAssignments();
        renderProfileSummary();
      });
    });

    bindSectionSettingsToggle('[data-settings="view-assignments"]', 'assignmentForm', '#assignmentsList .action-toggle, #assignmentArchiveList .action-toggle');
  }

  function getAllowanceTotals() {
    const income = state.allowance.reduce((sum, entry) => sum + (Number(entry.amount) > 0 ? Number(entry.amount) : 0), 0);
    const spent = state.allowance.reduce((sum, entry) => sum + (Number(entry.amount) < 0 ? Math.abs(Number(entry.amount)) : 0), 0);
    const remaining = income - spent;
    return { income, spent, remaining };
  }

  function getAllowanceEntryTimestamp(entry) {
    const timestamp = Number(entry?.createdAt || entry?.date || Date.now());
    return Number.isFinite(timestamp) ? timestamp : Date.now();
  }

  function getAllowanceBuckets() {
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000;

    return {
      current: state.allowance.filter((entry) => getAllowanceEntryTimestamp(entry) >= cutoff).sort((a, b) => getAllowanceEntryTimestamp(b) - getAllowanceEntryTimestamp(a)),
      archive: state.allowance.filter((entry) => getAllowanceEntryTimestamp(entry) < cutoff).sort((a, b) => getAllowanceEntryTimestamp(b) - getAllowanceEntryTimestamp(a)),
    };
  }

  function renderAllowance() {
    const budgetSummary = document.getElementById('budgetSummary');
    const allowanceList = document.getElementById('allowanceList');
    const archiveToggle = document.getElementById('allowanceArchiveToggle');
    const archiveModal = document.getElementById('allowanceArchiveModal');
    const archiveList = document.getElementById('allowanceArchiveList');
    if (!budgetSummary || !allowanceList) return;

    const totals = getAllowanceTotals();
    budgetSummary.innerHTML = `
      <div>
        <span>Income</span>
        <strong>${formatCurrency(totals.income)}</strong>
      </div>
      <div>
        <span>Spent</span>
        <strong>${formatCurrency(totals.spent)}</strong>
      </div>
      <div>
        <span>Remaining</span>
        <strong>${formatCurrency(totals.remaining)}</strong>
      </div>
    `;

    const { current, archive } = getAllowanceBuckets();

    if (!current.length) {
      allowanceList.innerHTML = '<li class="empty-state">No recent entries within 24 hours. Add your next income or expense.</li>';
    } else {
      allowanceList.innerHTML = current
        .map(
          (entry) => `
            <li data-allowance-id="${entry.id}">
              <div>
                <strong>${entry.label}</strong>
                <span>${entry.type === 'income' ? 'Income' : 'Expense'}</span>
              </div>
              <div class="item-actions">
                <strong class="${Number(entry.amount) >= 0 ? 'income-positive' : 'expense-negative'}">${formatCurrency(entry.amount)}</strong>
                <button class="inline-action action-toggle" type="button" data-edit-allowance="${entry.id}">Edit</button>
                <button class="inline-action delete action-toggle" type="button" data-delete-allowance="${entry.id}">Delete</button>
              </div>
            </li>
          `
        )
        .join('');
    }

    if (archiveToggle) {
      archiveToggle.hidden = false;
    }

    if (archiveList) {
      if (!archive.length) {
        archiveList.innerHTML = '<li class="empty-state">No archived entries yet.</li>';
      } else {
        archiveList.innerHTML = archive
          .map(
            (entry) => `
              <li data-allowance-id="${entry.id}">
                <div>
                  <strong>${entry.label}</strong>
                  <span>${entry.type === 'income' ? 'Income' : 'Expense'}</span>
                </div>
                <div class="item-actions">
                  <strong class="${Number(entry.amount) >= 0 ? 'income-positive' : 'expense-negative'}">${formatCurrency(entry.amount)}</strong>
                  <button class="inline-action action-toggle" type="button" data-edit-allowance="${entry.id}">Edit</button>
                  <button class="inline-action delete action-toggle" type="button" data-delete-allowance="${entry.id}">Delete</button>
                </div>
              </li>
            `
          )
          .join('');
      }
    }

    if (archiveModal) {
      archiveModal.classList.add('hidden');
      archiveModal.setAttribute('aria-hidden', 'true');
    }

    if (archiveToggle) {
      archiveToggle.textContent = 'Archive';
      archiveToggle.classList.remove('active');
    }

    allowanceList.querySelectorAll('[data-edit-allowance]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.editAllowance);
        const entry = state.allowance.find((item) => Number(item.id) === id);
        if (!entry) return;
        document.getElementById('allowanceLabel').value = entry.label;
        document.getElementById('allowanceAmount').value = Math.abs(Number(entry.amount));
        document.getElementById('allowanceForm').dataset.editingId = String(entry.id);
      });
    });

    allowanceList.querySelectorAll('[data-delete-allowance]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.deleteAllowance);
        state.allowance = state.allowance.filter((item) => Number(item.id) !== id);
        saveProfileData();
        renderAllowance();
        renderProfileSummary();
      });
    });

    bindSectionSettingsToggle('[data-settings="view-allowance"]', 'allowanceForm', '#allowanceList .action-toggle, #allowanceArchiveList .action-toggle');

    archiveList?.querySelectorAll('[data-edit-allowance]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.editAllowance);
        const entry = state.allowance.find((item) => Number(item.id) === id);
        if (!entry) return;
        document.getElementById('allowanceLabel').value = entry.label;
        document.getElementById('allowanceAmount').value = Math.abs(Number(entry.amount));
        document.getElementById('allowanceForm').dataset.editingId = String(entry.id);
        archiveModal?.classList.add('hidden');
      });
    });

    archiveList?.querySelectorAll('[data-delete-allowance]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.deleteAllowance);
        state.allowance = state.allowance.filter((item) => Number(item.id) !== id);
        saveProfileData();
        renderAllowance();
        renderProfileSummary();
      });
    });

    archiveToggle?.addEventListener('click', () => {
      if (!archiveModal) return;
      archiveModal.classList.toggle('hidden');
      archiveModal.setAttribute('aria-hidden', String(archiveModal.classList.contains('hidden')));
    });

    document.getElementById('closeAllowanceArchive')?.addEventListener('click', () => {
      if (!archiveModal) return;
      archiveModal.classList.add('hidden');
      archiveModal.setAttribute('aria-hidden', 'true');
    });
  }

  function bindGoalForm() {
    const goalForm = document.getElementById('goalForm');
    const goalProgress = document.getElementById('goalProgress');
    const goalProgressValue = document.getElementById('goalProgressValue');
    const progressStatuses = document.querySelectorAll('.progress-status');

    const syncGoalProgress = (value) => {
      const intValue = Number(value) || 0;
      goalProgress.value = String(intValue);
      goalProgressValue.textContent = `${intValue}%`;

      progressStatuses.forEach((button) => {
        const matches = Number(button.dataset.progress) === intValue;
        button.classList.toggle('active', matches);
      });
    };

    progressStatuses.forEach((button) => {
      button.addEventListener('click', () => {
        syncGoalProgress(button.dataset.progress);
      });
    });

    goalForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = document.getElementById('goalTitle').value.trim();
      const note = document.getElementById('goalNote').value.trim();
      const progress = Number(goalProgress.value);

      if (!title || !note) return;

      const editingId = goalForm.dataset.editingId;
      if (editingId) {
        state.goals = state.goals.map((goal) =>
          Number(goal.id) === Number(editingId) ? { ...goal, title, note, progress } : goal
        );
      } else {
        if (!canAddItem('goals', 'goals')) return;
        state.goals.push({ id: Date.now() + Math.random(), title, note, progress });
      }

      saveProfileData();
      goalForm.reset();
      goalForm.removeAttribute('data-editing-id');
      syncGoalProgress(50);
      renderGoals();
      renderProfileSummary();
    });

    document.getElementById('cancelGoalEdit').addEventListener('click', () => {
      goalForm.reset();
      goalForm.removeAttribute('data-editing-id');
      syncGoalProgress(50);
    });
  }

  function resetAssignmentFormState() {
    const assignmentForm = document.getElementById('assignmentForm');
    if (!assignmentForm) return;
    assignmentForm.reset();
    assignmentForm.removeAttribute('data-editing-id');
  }

  function bindAssignmentForm() {
    const assignmentForm = document.getElementById('assignmentForm');
    const archiveToggle = document.getElementById('toggleAssignmentArchive');
    const formFocusButton = document.getElementById('assignmentFormFocusBtn');
    const settingsButton = document.querySelector('[data-settings="view-assignments"]');

    if (settingsButton) {
      settingsButton.addEventListener('click', () => {
        const shouldShow = assignmentForm && assignmentForm.classList.contains('hidden');
        if (shouldShow) {
          resetAssignmentFormState();
        }
      });
    }

    if (archiveToggle) {
      archiveToggle.addEventListener('click', () => {
        const section = document.getElementById('assignmentArchiveSection');
        if (!section) return;
        toggleAssignmentArchive(section.hidden);
      });
    }

    if (formFocusButton) {
      formFocusButton.addEventListener('click', () => {
        resetAssignmentFormState();
        assignmentForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('assignmentTitle')?.focus();
      });
    }

    assignmentForm.addEventListener('click', () => {
      if (assignmentForm.dataset.editingId) {
        assignmentForm.dataset.editingId = '';
      }
    });

    assignmentForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = document.getElementById('assignmentTitle').value.trim();
      const date = document.getElementById('assignmentDate').value;
      const status = normalizeAssignmentStatus(document.getElementById('assignmentStatus').value);

      if (!title || !date) return;

      const rawEditingId = assignmentForm.dataset.editingId;
      const editingId = rawEditingId && state.assignments.some((assignment) => Number(assignment.id) === Number(rawEditingId))
        ? Number(rawEditingId)
        : null;

      if (editingId !== null) {
        state.assignments = state.assignments.map((assignment) =>
          Number(assignment.id) === editingId ? { ...assignment, title, date, status } : assignment
        );
      } else {
        if (!canAddItem('assignments', 'assignments')) return;
        state.assignments.push({
          id: Date.now() + Math.random(),
          title,
          date,
          status,
        });
      }

      saveProfileData();
      resetAssignmentFormState();
      if (!state.assignments.some((item) => normalizeAssignmentStatus(item.status) === 'done')) {
        resetAssignmentArchiveState();
      }
      renderAssignments();
      renderProfileSummary();
    });

    document.getElementById('cancelAssignmentEdit')?.addEventListener('click', () => {
      resetAssignmentFormState();
    });
  }

  function bindAllowanceForm() {
    const allowanceForm = document.getElementById('allowanceForm');

    allowanceForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const label = document.getElementById('allowanceLabel').value.trim();
      const amount = Number(document.getElementById('allowanceAmount').value);

      if (!label || Number.isNaN(amount)) return;

      const entryType = amount >= 0 ? 'income' : 'expense';
      const normalizedAmount = entryType === 'income' ? Math.abs(amount) : -Math.abs(amount);
      const editingId = allowanceForm.dataset.editingId;
      const nextEntry = {
        id: Date.now(),
        label,
        amount: normalizedAmount,
        type: entryType,
        createdAt: Date.now(),
      };

      if (editingId) {
        state.allowance = state.allowance.map((entry) =>
          Number(entry.id) === Number(editingId)
            ? { ...entry, label, amount: normalizedAmount, type: entryType, createdAt: entry.createdAt || Date.now() }
            : entry
        );
      } else {
        state.allowance.push(nextEntry);
      }

      saveProfileData();
      allowanceForm.reset();
      allowanceForm.removeAttribute('data-editing-id');
      renderAllowance();
      renderProfileSummary();
    });

    document.getElementById('cancelAllowanceEdit').addEventListener('click', () => {
      allowanceForm.reset();
      allowanceForm.removeAttribute('data-editing-id');
    });
  }

  function renderReviewTools() {
    const reviewGrid = document.getElementById('reviewGrid');
    if (!reviewGrid) return;

    const tools = [
      { id: 'pomodoro', icon: '⏱️', name: 'Pomodoro', description: 'Study in focused work and break intervals.' },
      { id: 'playlist', icon: '🎧', name: 'Study playlists', description: 'Save and open your study soundtrack links.' },
    ];

    reviewGrid.innerHTML = tools
      .map(
        (tool) => `
          <button class="review-card compact-card" type="button" data-tool="${tool.id}">
            <div class="tool-icon">${tool.icon}</div>
            <h4>${tool.name}</h4>
            <p>${tool.description}</p>
          </button>
        `
      )
      .join('');

    reviewGrid.querySelectorAll('[data-tool]').forEach((button) => {
      button.addEventListener('click', () => {
        openTool(button.dataset.tool);
      });
    });
  }

  function applyPomodoroState() {
    if (state.pomodoro.timerId) {
      clearInterval(state.pomodoro.timerId);
      state.pomodoro.timerId = null;
    }

    if (!state.pomodoro.isRunning) {
      savePomodoroSettings();
      return;
    }

    state.pomodoro.timerId = setInterval(() => {
      if (state.pomodoro.remainingSeconds <= 0) {
        state.pomodoro.mode = state.pomodoro.mode === 'work' ? 'break' : 'work';
        const nextMinutes = state.pomodoro.mode === 'work' ? state.pomodoro.workMinutes : state.pomodoro.breakMinutes;
        state.pomodoro.remainingSeconds = nextMinutes * 60;
        savePomodoroSettings();

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Pomodoro complete', {
            body: state.pomodoro.mode === 'work' ? 'Time to focus on your next study block.' : 'Break time is over — back to work!',
          });
        } else if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }

        if (document.getElementById('pomodoroTimerDisplay')) {
          const timerDisplay = document.getElementById('pomodoroTimerDisplay');
          const statusText = document.getElementById('pomodoroModeStatus');
          timerDisplay.textContent = formatClock(state.pomodoro.remainingSeconds);
          statusText.textContent = state.pomodoro.mode === 'work' ? 'Work session' : 'Break time';
        }
        return;
      }

      state.pomodoro.remainingSeconds -= 1;
      savePomodoroSettings();
      if (document.getElementById('pomodoroTimerDisplay')) {
        document.getElementById('pomodoroTimerDisplay').textContent = formatClock(state.pomodoro.remainingSeconds);
      }
    }, 1000);
  }

  function renderPomodoroTool() {
    const toolContent = document.getElementById('toolContent');
    if (!toolContent) return;

    const activeModeLabel = state.pomodoro.mode === 'work' ? 'Work session' : 'Break time';
    toolContent.innerHTML = `
      <div class="tool-header compact-header">
        <div>
          <h2>Pomodoro</h2>
          <p>Focus in consistent study sprints.</p>
        </div>
      </div>
      <div class="tool-box compact-box">
        <div class="pomodoro-status" id="pomodoroModeStatus">${activeModeLabel}</div>
        <div class="big-timer" id="pomodoroTimerDisplay">${formatClock(state.pomodoro.remainingSeconds)}</div>
        <div class="timer-actions">
          <button class="small-btn primary" type="button" data-pomodoro-action="toggle">${state.pomodoro.isRunning ? 'Pause' : 'Start'}</button>
          <button class="small-btn secondary" type="button" data-pomodoro-action="reset">Reset</button>
        </div>
        <div class="pomodoro-settings">
          <label>
            Work minutes
            <input type="number" min="1" max="90" value="${state.pomodoro.workMinutes}" id="pomodoroWorkMinutes" />
          </label>
          <label>
            Break minutes
            <input type="number" min="1" max="30" value="${state.pomodoro.breakMinutes}" id="pomodoroBreakMinutes" />
          </label>
          <button class="small-btn secondary" type="button" data-pomodoro-action="save-settings">Save settings</button>
        </div>
      </div>
    `;

    document.querySelector('[data-pomodoro-action="toggle"]').addEventListener('click', () => {
      state.pomodoro.isRunning = !state.pomodoro.isRunning;
      if (!state.pomodoro.isRunning) {
        if (state.pomodoro.timerId) {
          clearInterval(state.pomodoro.timerId);
          state.pomodoro.timerId = null;
        }
      } else {
        applyPomodoroState();
      }
      savePomodoroSettings();
      renderPomodoroTool();
    });

    document.querySelector('[data-pomodoro-action="reset"]').addEventListener('click', () => {
      state.pomodoro.isRunning = false;
      if (state.pomodoro.timerId) {
        clearInterval(state.pomodoro.timerId);
        state.pomodoro.timerId = null;
      }
      state.pomodoro.mode = 'work';
      state.pomodoro.remainingSeconds = state.pomodoro.workMinutes * 60;
      savePomodoroSettings();
      renderPomodoroTool();
    });

    document.querySelector('[data-pomodoro-action="save-settings"]').addEventListener('click', () => {
      const workMinutes = Number(document.getElementById('pomodoroWorkMinutes').value);
      const breakMinutes = Number(document.getElementById('pomodoroBreakMinutes').value);
      state.pomodoro.workMinutes = Number.isFinite(workMinutes) && workMinutes > 0 ? workMinutes : 25;
      state.pomodoro.breakMinutes = Number.isFinite(breakMinutes) && breakMinutes > 0 ? breakMinutes : 5;
      state.pomodoro.mode = 'work';
      state.pomodoro.isRunning = false;
      state.pomodoro.remainingSeconds = state.pomodoro.workMinutes * 60;
      savePomodoroSettings();
      renderPomodoroTool();
    });
  }

  function renderPlaylistTool() {
    const toolContent = document.getElementById('toolContent');
    if (!toolContent) return;

    toolContent.innerHTML = `
      <div class="tool-header compact-header">
        <div>
          <h2>Study playlist</h2>
          <p>Curated audio for your next study block.</p>
        </div>
        <button class="playlist-settings-btn" type="button" data-playlist-settings aria-label="Playlist settings">⚙</button>
      </div>

      <div class="tool-box compact-box">
        <div class="playlist-settings hidden" id="playlistSettingsForm">
          <label>
            Playlist title
            <input type="text" id="playlistTitleInput" placeholder="Morning focus" />
          </label>
          <label>
            Playlist URL
            <input type="url" id="playlistUrlInput" placeholder="https://youtube.com/..." />
          </label>
          <div class="timer-actions">
            <button class="small-btn primary" type="button" data-playlist-add>Add playlist</button>
          </div>
        </div>

        <div class="playlist-list">
          ${state.playlists
            .map(
              (playlist) => `
                <div class="playlist-item-wrap">
                  <button class="playlist-item" type="button" data-playlist-url="${playlist.url}">
                    <span class="playlist-title">${playlist.title}</span>
                    <small>${playlist.url}</small>
                  </button>
                  <button class="inline-action delete playlist-delete" type="button" data-remove-playlist="${playlist.id}">Remove</button>
                </div>
              `
            )
            .join('')}
        </div>
      </div>
    `;

    document.querySelector('[data-playlist-settings]')?.addEventListener('click', () => {
      const settingsForm = document.getElementById('playlistSettingsForm');
      const isOpen = settingsForm.classList.toggle('hidden');

      document.querySelectorAll('.playlist-delete').forEach((button) => {
        button.classList.toggle('visible', !isOpen);
      });
    });

    document.querySelector('[data-playlist-add]')?.addEventListener('click', () => {
      const title = document.getElementById('playlistTitleInput').value.trim();
      const url = document.getElementById('playlistUrlInput').value.trim();
      if (!title || !url) return;

      state.playlists.push({ id: Date.now(), title, url });
      savePlaylists();
      renderPlaylistTool();
    });

    document.querySelectorAll('[data-playlist-url]').forEach((button) => {
      button.addEventListener('click', () => {
        const url = button.dataset.playlistUrl;
        window.open(url, '_blank', 'noopener,noreferrer');
      });
    });

    document.querySelectorAll('[data-remove-playlist]').forEach((button) => {
      button.addEventListener('click', () => {
        const playlistId = Number(button.dataset.removePlaylist);
        state.playlists = state.playlists.filter((playlist) => Number(playlist.id) !== playlistId);
        savePlaylists();
        renderPlaylistTool();
      });
    });
  }

  function openTool(toolId) {
    const toolScreen = document.getElementById('toolScreen');
    const toolContent = document.getElementById('toolContent');

    if (toolId === 'pomodoro') {
      renderPomodoroTool();
    } else if (toolId === 'playlist') {
      renderPlaylistTool();
    }

    toolScreen.classList.remove('hidden');
    document.getElementById('dashboardShell').classList.add('hidden');
    state.activeTool = toolId;
  }

  function closeTool() {
    document.getElementById('toolScreen').classList.add('hidden');
    document.getElementById('dashboardShell').classList.remove('hidden');
    state.activeTool = null;
  }

  function initializeAuth() {
    setAuthTab('signup');

    authTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        setAuthTab(tab.dataset.auth);
      });
    });
  }

  function initializeProfileLoader() {
    const activeProfileId = localStorage.getItem(ACTIVE_PROFILE_KEY);
    const profiles = getProfiles();
    const currentProfile = activeProfileId ? profiles[activeProfileId] : null;

    if (currentProfile) {
      state.profile = currentProfile;
      loadProfileData();
      renderProfileSummary();
      renderGoals();
      renderAssignments();
      renderAllowance();
      renderClasses();
      showDashboard();
    }
  }

  function bindAuthForms() {
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const avatarInput = document.getElementById('avatarInput');
    const avatarPreview = document.getElementById('avatarPreview');

    if (avatarInput && avatarPreview) {
      avatarInput.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          avatarPreview.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    signupForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(signupForm);
      const fullName = String(formData.get('fullName') || '').trim();
      const age = String(formData.get('age') || '').trim();
      const grade = String(formData.get('grade') || '').trim();
      const schoolId = String(formData.get('schoolId') || '').trim();
      const password = String(formData.get('password') || '').trim();
      const profiles = getProfiles();

      if (!fullName || !age || !grade || !schoolId || !password) {
        return;
      }

      if (profiles[schoolId]) {
        alert('An account with this School ID already exists. Please log in instead.');
        return;
      }

      const profile = {
        fullName,
        age,
        grade,
        schoolId,
        password,
        premium: false,
        currency: 'USD',
        avatar: avatarPreview.src || makeAvatar(fullName),
      };

      profiles[schoolId] = profile;
      saveProfiles(profiles);
      localStorage.setItem(ACTIVE_PROFILE_KEY, schoolId);
      state.profile = profile;
      loadProfileData();
      renderProfileSummary();
      renderGoals();
      renderAssignments();
      renderAllowance();
      renderClasses();
      showDashboard();
      signupForm.reset();
      avatarPreview.src = '';
    });

    loginForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const schoolId = String(document.querySelector('#loginForm input[name="loginSchoolId"]').value || '').trim();
      const password = String(document.querySelector('#loginForm input[name="loginPassword"]').value || '').trim();
      const profiles = getProfiles();
      const account = profiles[schoolId];

      if (!account) {
        alert('No account found for that School ID.');
        return;
      }

      if (account.password !== password) {
        alert('Incorrect password. Please try again.');
        return;
      }

      state.profile = account;
      localStorage.setItem(ACTIVE_PROFILE_KEY, schoolId);
      loadProfileData();
      renderProfileSummary();
      renderGoals();
      renderAssignments();
      renderAllowance();
      renderClasses();
      showDashboard();
      loginForm.reset();
    });
  }

  function bindClassForm() {
    const classForm = document.getElementById('classForm');
    if (!classForm) return;

    classForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = document.getElementById('className').value.trim();
      const professor = document.getElementById('classProfessor').value.trim();
      const time = document.getElementById('classTime').value;
      const days = Array.from(document.querySelectorAll('input[name="classDay"]:checked')).map((checkbox) => checkbox.value);

      if (!name || !professor || !time || !days.length) return;

      const rawEditingId = classForm.dataset.editingId;
      const editingId = rawEditingId ? Number(rawEditingId) : null;
      const existingClass = editingId !== null && Number.isFinite(editingId)
        ? state.classes.find((item) => Number(item.id) === editingId)
        : null;

      const item = {
        id: existingClass ? existingClass.id : Date.now() + Math.random(),
        name,
        professor,
        days,
        time,
      };

      if (existingClass) {
        state.classes = state.classes.map((entry) =>
          Number(entry.id) === editingId ? item : entry
        );
      } else {
        if (!canAddItem('classes', 'classes')) return;
        state.classes.push(item);
      }

      saveProfileData();
      classForm.reset();
      classForm.removeAttribute('data-editing-id');
      renderClasses();
      renderProfileSummary();
    });

    const cancelButton = document.getElementById('cancelClassEdit');
    if (cancelButton) {
      cancelButton.addEventListener('click', () => {
        classForm.reset();
        classForm.removeAttribute('data-editing-id');
        classForm.classList.add('hidden');
        classForm.style.display = 'none';
        document.querySelectorAll('#classesList .action-toggle').forEach((el) => el.classList.remove('visible'));
      });
    }

    classForm.addEventListener('reset', () => {
      classForm.removeAttribute('data-editing-id');
      document.querySelectorAll('input[name="classDay"]').forEach((checkbox) => {
        checkbox.checked = false;
      });
    });

    classForm.addEventListener('submit', () => {
      classForm.classList.add('hidden');
      classForm.style.display = 'none';
      document.querySelectorAll('#classesList .action-toggle').forEach((el) => el.classList.remove('visible'));
    });
  }

  function bindDashboardActions() {
    navItems.forEach((button) => {
      button.addEventListener('click', () => {
        setActiveView(button.dataset.view);
      });
    });

    const saveProfileSettingsButton = document.getElementById('saveProfileSettings');
    if (saveProfileSettingsButton) {
      saveProfileSettingsButton.addEventListener('click', () => {
        const profiles = getProfiles();
        const currentSchoolId = state.profile?.schoolId;
        if (!currentSchoolId || !profiles[currentSchoolId]) {
          return;
        }

        const fullNameInput = document.getElementById('settingsFullName');
        const schoolIdInput = document.getElementById('settingsSchoolId');
        const passwordInput = document.getElementById('settingsPassword');
        const ageInput = document.getElementById('settingsAge');
        const gradeInput = document.getElementById('settingsGrade');
        const avatarInput = document.getElementById('settingsAvatarInput');
        const avatarPreview = document.getElementById('settingsAvatarPreview');

        const updatedProfile = { ...profiles[currentSchoolId] };
        const newFullName = String(fullNameInput?.value || '').trim();
        const newSchoolId = String(schoolIdInput?.value || '').trim();
        const newPassword = String(passwordInput?.value || '').trim();
        const newAge = String(ageInput?.value || '').trim();
        const newGrade = String(gradeInput?.value || '').trim();

        if (newFullName) {
          updatedProfile.fullName = newFullName;
        }
        if (newSchoolId) {
          updatedProfile.schoolId = newSchoolId;
        }
        if (newPassword) {
          updatedProfile.password = newPassword;
        }
        if (newAge) {
          updatedProfile.age = newAge;
        }
        if (newGrade) {
          updatedProfile.grade = newGrade;
        }

        if (newSchoolId && newSchoolId !== currentSchoolId) {
          delete profiles[currentSchoolId];
          profiles[newSchoolId] = updatedProfile;
          localStorage.setItem(ACTIVE_PROFILE_KEY, newSchoolId);
          state.profile = updatedProfile;
        }

        if (avatarInput?.files?.[0]) {
          const reader = new FileReader();
          reader.onload = () => {
            updatedProfile.avatar = String(reader.result || updatedProfile.avatar);
            const targetSchoolId = newSchoolId && newSchoolId !== currentSchoolId ? newSchoolId : currentSchoolId;
            profiles[targetSchoolId] = updatedProfile;
            saveProfiles(profiles);
            state.profile = updatedProfile;
            renderProfileSummary();
            if (avatarPreview) avatarPreview.src = updatedProfile.avatar || makeAvatar(updatedProfile.fullName || 'Student');
          };
          reader.readAsDataURL(avatarInput.files[0]);
          return;
        }

        const targetSchoolId = newSchoolId && newSchoolId !== currentSchoolId ? newSchoolId : currentSchoolId;
        profiles[targetSchoolId] = updatedProfile;
        saveProfiles(profiles);
        state.profile = updatedProfile;
        renderProfileSummary();
      });
    }

    const upgradePremiumButton = document.getElementById('upgradePremiumButton');
    if (upgradePremiumButton) {
      upgradePremiumButton.addEventListener('click', () => {
        if (isPremium() || !state.profile) return;

        const confirmed = window.confirm('This local demo will activate Premium. Connect a real payment provider before using this as a paid checkout. Continue?');
        if (!confirmed) return;

        const profiles = getProfiles();
        const schoolId = state.profile.schoolId;
        state.profile = { ...state.profile, premium: true };
        profiles[schoolId] = state.profile;
        saveProfiles(profiles);
        renderProfileSummary();
        renderPremiumStatus();
      });
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
      showAuthShell();
      setAuthTab('signup');
    });

    document.getElementById('backFromTool').addEventListener('click', () => {
      closeTool();
    });
  }

  function init() {
    loadPomodoroSettings();
    loadPlaylists();
    initializeAuth();
    bindAuthForms();
    bindDashboardActions();
    bindGoalForm();
    bindAssignmentForm();
    bindAllowanceForm();
    bindClassForm();
    renderReviewTools();
    bindEmergencyStickerForm();

    const savedDarkMode = localStorage.getItem(DARK_MODE_KEY);
    applyTheme(savedDarkMode === null ? true : savedDarkMode === 'true');

    const darkModeToggle = document.getElementById('darkModeToggle');
    darkModeToggle.addEventListener('change', (event) => {
      applyTheme(Boolean(event.target.checked));
    });

    const currencySelect = document.getElementById('currencySelect');
    currencySelect?.addEventListener('change', (event) => {
      if (!state.profile) return;

      const profiles = getProfiles();
      const schoolId = state.profile.schoolId;
      state.profile = { ...state.profile, currency: event.target.value };
      profiles[schoolId] = state.profile;
      saveProfiles(profiles);
      renderAllowance();
      renderProfileSummary();
    });

    initializeProfileLoader();
    setAuthTab('signup');
  }

  init();
})();
