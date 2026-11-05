(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const KEY = 'neo-oprs-offline-v1';
  // Set this to your backend origin when the payment API is deployed.
  // Keep Razorpay secret keys on the server; never place them in this file.
  const PAYMENT_API_BASE = window.PAYMENT_API_BASE || '';
  const today = new Date();
  const dateStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  $('#date').min = dateStr(today);
  $('#date').value = dateStr(new Date(today.getTime() + 86400000));
  $('#returnDate').min = $('#date').value;
  $('#year').textContent = today.getFullYear();
  const sample = () => {
    const d = dateStr(new Date(Date.now() + 86400000)), d2 = dateStr(new Date(Date.now() + 2 * 86400000));
    return {
      users: [{ name: 'Platform Administrator', email: 'admin@neo.example', password: 'admin123', role: 'admin' }], crews: [], assignments: [], tripLogs: [], services: [
        { id: 1, from: 'Bengaluru', to: 'Thalassery', date: d, depart: '20:15', arrive: '05:30', fare: 980, bus: 'Super Fast', code: 'SF-204', depot: 'Bengaluru Depot', seats: 31, boarding: 'Majestic Bus Stand, Satellite Bus Stand', stops: 'Mysuru, Kozhikode', status: 'Scheduled' },
        { id: 2, from: 'Bengaluru', to: 'Kozhikode', date: d, depart: '21:00', arrive: '06:00', fare: 1050, bus: 'Swift Deluxe', code: 'SW-118', depot: 'Bengaluru Depot', seats: 31, boarding: 'Majestic Bus Stand, Electronic City', stops: 'Mysuru, Sulthan Bathery', status: 'Scheduled' },
        { id: 3, from: 'Thalassery', to: 'Bengaluru', date: d2, depart: '19:30', arrive: '05:00', fare: 990, bus: 'Super Fast', code: 'SF-205', depot: 'Thalassery Depot', seats: 31, boarding: 'Thalassery New Bus Stand, Kannur', stops: 'Kozhikode, Mysuru', status: 'Scheduled' },
        { id: 4, from: 'Kochi', to: 'Bengaluru', date: d, depart: '20:00', arrive: '06:15', fare: 1150, bus: 'Swift Deluxe', code: 'SW-220', depot: 'Ernakulam Depot', seats: 31, boarding: 'Vyttila Mobility Hub, Aluva', stops: 'Thrissur, Mysuru', status: 'Scheduled' }
      ], bookings: [], current: null, nextId: 5
    };

  };
  const DEFAULT_CITY_ALIASES = {
    Bengaluru: ['Bangalore', 'Bangaluru', 'Bengalooru'],
    Mumbai: ['Bombay'],
    Kolkata: ['Calcutta'],
    Chennai: ['Madras']
  };
  let db;
  try {
    db = JSON.parse(localStorage.getItem(KEY)) || sample();

  }
  catch {
    db = sample();

  }
  db.crews ||= [];
  db.assignments ||= [];
  db.tripLogs ||= [];
  db.cityAliases ||= structuredClone(DEFAULT_CITY_ALIASES);
  function save() {
    localStorage.setItem(KEY, JSON.stringify(db));

  }
  function normalizeCityName(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');

  }
  function canonicalCity(value) {
    const normalized = normalizeCityName(value);
    if (!normalized)
      return '';
    for (const [canonical, aliases] of Object.entries(db.cityAliases || {})) {
      const candidates = [canonical, ...(Array.isArray(aliases) ? aliases : [])];
      if (candidates.some(name => normalizeCityName(name) === normalized)) {
        return normalizeCityName(canonical);

      }

    }
    return normalized;

  }
  function cityMatches(storedCity, requestedCity) {
    const stored = canonicalCity(storedCity);
    const requested = canonicalCity(requestedCity);
    const rawQuery = normalizeCityName(requestedCity);
    if (!stored || !requested)
      return false;
    if (stored === requested)
      return true;
    if (rawQuery.length < 3)
      return false;
    // Match partial input against canonical names and configured aliases.
    if (stored.includes(requested))
      return true;
    return Object.entries(db.cityAliases || {}).some(([canonical, aliases]) => {
      if (normalizeCityName(canonical) !== stored)
        return false;
      return [canonical, ...(Array.isArray(aliases) ? aliases : [])]
        .some(name => normalizeCityName(name).includes(rawQuery));

    });

  }
  function refreshCities() {
    const datalist = $('#citySuggestions');
    if (!datalist)
      return;
    const cities = new Set();
    db.services.forEach(service => {
      cities.add(service.from);
      cities.add(service.to);

    });
    Object.entries(db.cityAliases || {}).forEach(([canonical, aliases]) => {
      cities.add(canonical);
      (Array.isArray(aliases) ? aliases : []).forEach(alias => cities.add(alias));

    });
    datalist.innerHTML = [...cities]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map(city => `<option value="${escape(city)}"></option>`)
      .join('');

  }
  function renderTimetable() {
    const services = db.services.filter(s => ['Scheduled', 'Boarding'].includes(s.status) && new Date(`${s.date}T${s.depart || '00:00'}:00`).getTime() > Date.now()).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.depart || '').localeCompare(b.depart || ''));
    $('#timetableBody').innerHTML = services.map(s => `<tr><td><strong>${escape(s.from)} → ${escape(s.to)}</strong></td><td>${escape(s.date || '—')}</td><td>${escape(s.depart || '—')}</td><td>${escape(s.arrive || '—')}</td><td>${escape(s.bus || '—')} · ${escape(s.code || '—')}</td><td>₹${Number(s.fare || 0).toLocaleString('en-IN')}</td><td><span class="badge">${escape(s.status)}</span></td></tr>`).join('') || '<tr><td colspan="7" class="table-empty">No scheduled services at the moment. Please check again soon.</td></tr>';

  }
  function refreshPublicInfo() {
    refreshCities();
    renderTimetable();

  }
  // Hero gallery: rotate automatically every five seconds, with manual dot controls.
  let activeSlide = 0;
  const slides = $$('.hero-slide'), slideDots = $$('[data-slide]');
  function showSlide(index) {
    if (!slides.length)
      return;
    activeSlide = (index + slides.length) % slides.length;
    slides.forEach((img, i) => img.classList.toggle('active', i === activeSlide));
    slideDots.forEach((dot, i) => {
      dot.classList.toggle('active', i === activeSlide);
      dot.setAttribute('aria-current', i === activeSlide ? 'true' : 'false');

    });

  }
  slideDots.forEach(dot => dot.addEventListener('click', () => showSlide(Number(dot.dataset.slide))));
  if (slides.length > 1)
    setInterval(() => showSlide(activeSlide + 1), 5000);
  // Responsive navigation menu.
  const menuToggle = $('#menuToggle'), mainNav = $('#mainNav');
  menuToggle.onclick = () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    mainNav.classList.toggle('nav-open', !expanded);

  };
  mainNav.querySelectorAll('a,button').forEach(item => item.addEventListener('click', () => {
    mainNav.classList.remove('nav-open');
    menuToggle.setAttribute('aria-expanded', 'false');

  }));
  function escape(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 2800);

  }
  function open(id) {
    $('#' + id).classList.remove('hidden');

  }
  function closeAll() {
    $$('.overlay').forEach(x => x.classList.add('hidden'));

  }
  $$('[data-close]').forEach(b => b.onclick = closeAll);
  $$('.overlay').forEach(o => o.addEventListener('click', e => {
    if (e.target === o)
      closeAll();

  }));
  let authMode = 'login', search = { from: '', to: '', date: '', returnDate: '' }, activeService = null, selectedSeats = [], selectedFare = 0;
  function setMode(m) {
    authMode = m;
    $$('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === m));
    $('#nameField').classList.toggle('hidden', m !== 'register');
    $('#authName').required = m === 'register';
    $('#authTitle').textContent = m === 'register' ? 'Create your account' : m === 'admin' ? 'Administrator sign in' : m === 'crew' ? 'Crew sign in' : 'Sign in';
    $('#authSub').textContent = m === 'register' ? 'Create an account to keep your tickets together.' : m === 'crew' ? 'Authorised crew accounts only. Contact an administrator for access.' : 'Sign in to manage your bookings.';
    $('#authSubmit').textContent = m === 'register' ? 'Create account →' : 'Sign in →';
    $('#authHint').textContent = m === 'admin' ? 'Sign in with your administrator account.' : m === 'crew' ? 'Crew accounts are created by the administrator; public crew registration is disabled.' : 'Your account details are stored by this application.';
    $('#authError').textContent = '';

  }
  $$('[data-tab]').forEach(b => b.onclick = () => setMode(b.dataset.tab));
  $('#loginBtn').onclick = () => {
    setMode('login');
    open('authModal');

  };
  $('#adminBtn').onclick = () => {
    setMode('admin');
    $('#authEmail').value = 'admin@neo.example';
    $('#authPassword').value = 'admin123';
    open('authModal');

  };
  $('#crewBtn').onclick = () => {
    setMode('crew');
    open('authModal');

  };
  $('#authForm').onsubmit = e => {
    e.preventDefault();
    let email = $('#authEmail').value.trim().toLowerCase(), pass = $('#authPassword').value;
    let user = db.users.find(u => u.email.toLowerCase() === email && u.password === pass);
    if (authMode === 'register') {
      if (db.users.some(u => u.email.toLowerCase() === email))
        return $('#authError').textContent = 'An account with this email already exists.';
      user = { name: $('#authName').value.trim(), email, password: pass, role: 'user' };
      db.users.push(user);
      save();

    }
    else if (!user) {
      $('#authError').textContent = 'Email or password does not match our records.';
      return;

    }
    if (authMode === 'admin' && user.role !== 'admin')
      return $('#authError').textContent = 'This account does not have admin access.';
    if (authMode === 'crew' && user.role !== 'crew')
      return $('#authError').textContent = 'This is not an authorised crew account.';
    db.current = user.email;
    save();
    closeAll();
    updateHeader();
    toast('Welcome, ' + user.name + '!');
    if (user.role === 'admin')
      showAccount(true);
    else if (user.role === 'crew')
      showCrewAccount();

  };
  function updateHeader() {
    const u = currentUser();
    $('#loginBtn').textContent = u ? u.name.split(' ')[0] : 'Sign in';
    $('#adminBtn').textContent = u?.role === 'admin' ? 'Admin dashboard' : 'Admin sign in';
    $('#crewBtn').textContent = u?.role === 'crew' ? 'Crew dashboard' : 'Crew sign in';

  }
  function currentUser() {
    return db.users.find(u => u.email === db.current) || null;

  }
  $('#myBookingsBtn').onclick = () => showAccount(false);
  function showAccount(admin) {
    const u = currentUser();
    if (!u) {
      setMode('login');
      open('authModal');
      return;

    }
    $('#accountEyebrow').textContent = admin ? 'ADMINISTRATION' : 'YOUR ACCOUNT';
    $('#accountTitle').textContent = admin ? 'Admin dashboard' : 'My bookings';
    let c = $('#accountContent');
    if (admin && u.role === 'admin') {
      const confirmed = db.bookings.filter(b => b.status === 'Confirmed');
      c.innerHTML = `<div class="admin-grid"><div class="stat"><small>Published services</small><b>${db.services.filter(s => s.status === 'Scheduled').length}</b></div><div class="stat"><small>Confirmed bookings</small><b>${confirmed.length}</b></div><div class="stat"><small>Collected revenue</small><b>₹${db.bookings.filter(b => b.paymentStatus === 'Paid').reduce((total, booking) => total + Number(booking.fare || 0), 0).toLocaleString('en-IN')}</b></div></div><h3>Publish a service</h3><form class="admin-form" id="newService"><label>From<input name="from" required></label><label>To<input name="to" required></label><label>Date<input name="date" type="date" min="${dateStr(today)}" required></label><label>Departure<input name="depart" type="time" required></label><label>Arrival<input name="arrive" type="time" required></label><label>Fare (₹)<input name="fare" type="number" min="1" required></label><label>Bus type<input name="bus" value="Super Fast" required></label><label>Bus code<input name="code" required></label><label>Depot<input name="depot" value="Main Depot" required></label><label>Boarding points<input name="boarding" value="Main Bus Stand" required></label><label>Rest stops<input name="stops" value="En-route stop"></label><button class="btn green">Add service</button></form><h3 style="margin-top:24px">Services</h3>${db.services.map(s => `<div class="account-card"><h3>${escape(s.from)} → ${escape(s.to)} <span class="badge">${escape(s.status)}</span></h3><p>${escape(s.date)} · ${escape(s.depart)} · ₹${s.fare} · ${escape(s.code)}</p><div class="account-actions"><button class="mini" data-manifest="${s.id}">Passenger details & seats</button><button class="mini" data-cancel-service="${s.id}">Cancel service</button><button class="mini" data-delete-service="${s.id}">Delete service</button></div></div>`).join('') || '<p>No services.</p>'}<h3>All bookings</h3>${[...new Map(db.bookings.map(b => [b.ref, b])).values()].map(b => bookingCard(b, true)).join('') || '<p>No bookings yet.</p>'}<button class="mini" id="logout">Sign out</button>`;
      $('#newService').onsubmit = e => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        f.id = db.nextId++;
        f.fare = Number(f.fare);
        f.seats = seatInventory().length;
        f.status = 'Scheduled';
        db.services.push(f);
        save();
        refreshPublicInfo();
        showAccount(true);
        toast('Service published in this browser.');

      };
      $$('[data-manifest]').forEach(b => b.onclick = () => showManifest(+b.dataset.manifest));
      $$('[data-cancel-service]').forEach(b => b.onclick = () => {
        let s = db.services.find(s => s.id === +b.dataset.cancelService);
        if (s && confirm('Cancel this service?')) {
          s.status = 'Cancelled';
          db.bookings.filter(x => x.serviceId === s.id && x.status === 'Confirmed').forEach(x => x.status = 'Cancelled');
          save();
          refreshPublicInfo();
          showAccount(true);

        }

      });
      $$('[data-delete-service]').forEach(b => b.onclick = () => {
        if (confirm('Delete this service?')) {
          db.services = db.services.filter(s => s.id !== +b.dataset.deleteService);
          save();
          refreshPublicInfo();
          showAccount(true);

        }

      });

    }
    else {
      const own = db.bookings.filter(b => b.user === u.email);
      const ownGroups = [...new Map(own.map(b => [b.ref, b])).values()];
      c.innerHTML = ownGroups.map(b => bookingCard(b, false)).join('') || '<div class="empty">You have no bookings yet. Search for a bus to get started.</div>';

    }
    const logout = $('#logout');
    if (logout)
      logout.onclick = () => {
        db.current = null;
        save();
        updateHeader();
        closeAll();
        toast('Signed out.');

      };
    open('accountModal');

  }
  function seatInventory() {
    return Array.from({ length: 40 }, (_, i) => String(i + 1));

  }
  function showManifest(serviceId) {
    const service = db.services.find(s => s.id === serviceId);
    if (!service)
      return;
    const bookings = db.bookings.filter(b => b.serviceId === serviceId && b.status === 'Confirmed').sort((a, b) => a.seat.localeCompare(b.seat, undefined, { numeric: true }));
    const booked = new Set(bookings.map(b => b.seat));
    const available = seatInventory().filter(seat => !booked.has(seat));
    $('#accountEyebrow').textContent = 'ADMINISTRATION · PASSENGER MANIFEST';
    $('#accountTitle').textContent = `${service.from} → ${service.to}`;
    $('#accountContent').innerHTML = `<div class="manifest-meta"><b>${escape(service.bus)} · ${escape(service.code)}</b><span>${escape(service.date)} · ${escape(service.depart)}–${escape(service.arrive)}</span><span>Service status: ${escape(service.status)}</span></div>
 <div class="manifest-toolbar"><button class="btn green" id="printManifest">Print manifest / save as PDF</button><button class="btn outline" id="backToAdmin">← Back to admin dashboard</button></div>
 <h3>Booked passengers (${bookings.length})</h3>
 <div class="table-wrap"><table class="manifest-table"><thead><tr><th>#</th><th>Passenger name</th><th>Seat number</th><th>Gmail / email</th><th>Phone number</th></tr></thead><tbody>${bookings.map((b, i) => `<tr><td>${i + 1}</td><td>${escape(b.passenger)}</td><td>${escape(b.seat)}</td><td>${escape(b.email || '—')}</td><td>${escape(b.phone || '—')}</td></tr>`).join('') || '<tr><td colspan="5" class="table-empty">No confirmed passengers booked for this service yet.</td></tr>'}</tbody></table></div>
 <h3 class="available-heading">Available seats (${available.length})</h3>
 <div class="table-wrap"><table class="manifest-table available-table"><thead><tr><th>#</th><th colspan="2">Available seat number</th></tr></thead><tbody>${available.length ? available.map((seat, i) => `<tr><td>${i + 1}</td><td colspan="2">${seat}</td></tr>`).join('') : '<tr><td colspan="3" class="table-empty">No available seats.</td></tr>'}</tbody></table></div>
 <p class="hint manifest-note">Passenger manifest · Includes confirmed bookings only. Print or choose “Save as PDF” in the print dialog.</p>`;
    $('#backToAdmin').onclick = () => showAccount(true);
    $('#printManifest').onclick = () => printManifest(service, bookings, available);
    open('accountModal');

  }
  function printManifest(service, bookings, available) {
    const w = window.open('', '_blank', 'width=1000,height=800');
    if (!w)
      return toast('Allow pop-ups to print the manifest.');
    const bookedRows = bookings.map((b, i) => `<tr><td>${i + 1}</td><td>${escape(b.passenger)}</td><td>${escape(b.seat)}</td><td>${escape(b.email || '—')}</td><td>${escape(b.phone || '—')}</td></tr>`).join('') || '<tr><td colspan="5">No confirmed passengers booked.</td></tr>';
    const availableRows = available.map((seat, i) => `<tr><td>${i + 1}</td><td>${escape(seat)}</td></tr>`).join('') || '<tr><td colspan="2">No available seats.</td></tr>';
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Passenger Manifest - ${escape(service.code)}</title><style>body{font:13px Arial,sans-serif;color:#17251e;margin:28px}header{border-bottom:3px solid #12633f;padding-bottom:12px;margin-bottom:20px}h1{font-size:23px;margin:0 0 7px}h2{font-size:17px;margin:24px 0 9px}.meta{line-height:1.7;color:#4c5d52}table{width:100%;border-collapse:collapse;margin:8px 0 22px}th,td{border:1px solid #bccbc0;text-align:left;padding:9px}th{background:#eaf4ec}tbody tr:nth-child(even){background:#f8faf8}.note{margin-top:28px;font-size:10px;color:#68756d}@media print{body{margin:12mm}h2{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid}}</style></head><body><header><h1>NEO OPRS · PASSENGER MANIFEST</h1><div class="meta"><b>${escape(service.from)} → ${escape(service.to)}</b><br>${escape(service.bus)} · ${escape(service.code)} · ${escape(service.date)} · ${escape(service.depart)}–${escape(service.arrive)}<br>Service status: ${escape(service.status)}</div></header><h2>Booked passengers (${bookings.length})</h2><table><thead><tr><th>#</th><th>Passenger name</th><th>Seat number</th><th>Gmail / email</th><th>Phone number</th></tr></thead><tbody>${bookedRows}</tbody></table><h2>Available seats (${available.length})</h2><table><thead><tr><th>#</th><th>Available seat number</th></tr></thead><tbody>${availableRows}</tbody></table><p class="note">Contains passenger contact details. Handle and print securely. This independent platform is not affiliated with KSRTC.</p><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();

  }
  function bookingCard(b, admin) {
    const group = db.bookings.filter(x => x.ref === b.ref);
    const total = group.reduce((n, x) => n + Number(x.fare || 0), 0);
    return `<div class="account-card"><h3>${escape(b.from)} → ${escape(b.to)} <span class="badge">${escape(b.status)}</span></h3><p><b>${group.length} passenger(s)</b> · Seats ${group.map(x => escape(x.seat)).join(', ')}<br>${escape(b.date)} · ${escape(b.depart)} · ${escape(b.code)}<br>Booking reference: ${escape(b.ref)} · Total ₹${total.toLocaleString('en-IN')}<br>Payment: ${escape(b.paymentStatus || 'Pending')}<br>${group.map(x => `${escape(x.passenger)} (seat ${escape(x.seat)})`).join('<br>')}<br>Boarding: ${escape(b.boarding)} · Drop: ${escape(b.drop || b.to)}</p><div class="account-actions"><button class="mini" data-print="${b.ref}">Print ticket</button>${!admin && b.status === 'Confirmed' ? `<button class="mini" data-cancel-booking="${b.ref}">Cancel booking</button>` : ''}</div></div>`;

  }
  function bindAccountActions() {
    $$('[data-print]').forEach(b => b.onclick = () => printTicket(db.bookings.find(x => x.ref === b.dataset.print)));
    $$('[data-cancel-booking]').forEach(b => b.onclick = () => {
      const x = db.bookings.find(x => x.ref === b.dataset.cancelBooking);
      if (x && confirm('Cancel this booking for all passengers?')) {
        db.bookings.filter(y => y.ref === x.ref).forEach(y => y.status = 'Cancelled');
        save();
        showAccount(false);
        toast('Booking cancelled.');

      }

    });

  }
  const oldShowAccount = showAccount;
  showAccount = function(admin) {
    oldShowAccount(admin);
    bindAccountActions();
    if (admin && currentUser()?.role === 'admin') {
      renderCrewAdminTools();
      renderCityAliasAdminTools();

    }

  };
  function renderCrewAdminTools() {
    const host = $('#accountContent');
    if (!host || $('#crewAdminTools'))
      return;
    const section = document.createElement('section');
    section.id = 'crewAdminTools';
    section.className = 'crew-tools';
    const serviceOptions = db.services.filter(s => s.status !== 'Cancelled').map(s => `<option value="${s.id}">${escape(s.code)} · ${escape(s.from)} → ${escape(s.to)} · ${escape(s.date)}</option>`).join('');
    section.innerHTML = `<h3>Crew management</h3><p class="hint">Create authorised Driver and Conductor accounts. These accounts can sign in only through Crew sign in.</p>
 <form id="newCrewForm" class="admin-form"><label>Full name<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Phone<input name="phone" type="tel" required></label><label>Employee ID<input name="employeeId" required></label><label>Designation<select name="designation"><option>Driver</option><option>Conductor</option></select></label><label>Depot<input name="depot" required></label><label>Temporary password<input name="password" minlength="4" required></label><button class="btn green">Create crew account</button></form>
 <h3>Assign crew to service</h3><form id="assignCrewForm" class="admin-form"><label>Service<select name="serviceId" required>${serviceOptions}</select></label><label>Driver<select name="driverId"><option value="">Select driver</option>${db.crews.filter(c => c.designation === 'Driver' && c.active !== false).map(c => `<option value="${c.id}">${escape(c.name)} · ${escape(c.employeeId)}</option>`).join('')}</select></label><label>Conductor<select name="conductorId"><option value="">Select conductor</option>${db.crews.filter(c => c.designation === 'Conductor' && c.active !== false).map(c => `<option value="${c.id}">${escape(c.name)} · ${escape(c.employeeId)}</option>`).join('')}</select></label><button class="btn green">Save crew assignment</button></form>
 <h3>Current assignments</h3>${db.assignments.map(a => {
      const s = db.services.find(x => x.id === a.serviceId);
      return s ? `<div class="account-card"><b>${escape(s.code)} · ${escape(s.from)} → ${escape(s.to)}</b><p>Driver: ${escape(db.crews.find(c => c.id === a.driverId)?.name || 'Not assigned')} · Conductor: ${escape(db.crews.find(c => c.id === a.conductorId)?.name || 'Not assigned')}<br>Status: ${escape(a.serviceStatus || s.status)}</p><button class="mini" data-remove-assignment="${s.id}">Remove assignment</button></div>` : '';

    }).join('') || '<p>No crew assignments yet.</p>'}<h3>Registered crew</h3>${db.crews.map(c => `<div class="account-card"><b>${escape(c.name)}</b> · ${escape(c.designation)} · ${escape(c.employeeId)}<p>${escape(c.email)} · ${escape(c.phone)} · ${escape(c.depot)} · ${c.active === false ? 'Inactive' : 'Active'}</p><button class="mini" data-toggle-crew="${c.id}">${c.active === false ? 'Reactivate' : 'Deactivate'}</button></div>`).join('') || '<p>No crew accounts created yet.</p>'}`;
    host.appendChild(section);
    $('#newCrewForm').onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget));
      if (db.users.some(u => u.email.toLowerCase() === f.email.trim().toLowerCase()))
        return toast('That email is already in use.');
      const id = 'CR' + Date.now().toString(36).toUpperCase();
      const { password, ...crewData } = f;
      const crew = { id, ...crewData, email: f.email.trim().toLowerCase(), active: true };
      db.crews.push(crew);
      db.users.push({ name: f.name, email: crew.email, password, role: 'crew', crewId: id });
      save();
      showAccount(true);
      toast('Crew account created.');

    };
    $('#assignCrewForm').onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget));
      if (!f.driverId && !f.conductorId)
        return toast('Select at least one crew member.');
      const serviceId = Number(f.serviceId);
      const driver = db.crews.find(c => c.id === f.driverId), conductor = db.crews.find(c => c.id === f.conductorId);
      if (driver && driver.designation !== 'Driver' || conductor && conductor.designation !== 'Conductor')
        return toast('Crew designation does not match the assigned role.');
      if (driver && db.assignments.some(a => a.serviceId !== serviceId && a.driverId === driver.id && a.serviceStatus !== 'Completed'))
        return toast('This driver is already assigned to another active trip.');
      if (conductor && db.assignments.some(a => a.serviceId !== serviceId && a.conductorId === conductor.id && a.serviceStatus !== 'Completed'))
        return toast('This conductor is already assigned to another active trip.');
      let a = db.assignments.find(x => x.serviceId === serviceId);
      if (!a) {
        a = { serviceId, boardingStatus: {}, serviceStatus: 'Scheduled', logs: [] };
        db.assignments.push(a);

      }
      a.driverId = f.driverId || '';
      a.conductorId = f.conductorId || '';
      save();
      showAccount(true);
      toast('Crew assignment saved.');

    };
    $$('[data-remove-assignment]').forEach(b => b.onclick = () => {
      const id = Number(b.dataset.removeAssignment);
      if (confirm('Remove crew assignment for this service?')) {
        db.assignments = db.assignments.filter(a => a.serviceId !== id);
        save();
        showAccount(true);
        toast('Crew assignment removed.');

      }

    });
    $$('[data-toggle-crew]').forEach(b => b.onclick = () => {
      const c = db.crews.find(x => x.id === b.dataset.toggleCrew);
      if (c) {
        c.active = c.active === false;
        const u = db.users.find(x => x.crewId === c.id);
        if (u)
          u.disabled = c.active === false;
        save();
        showAccount(true);

      }

    });

  }
  function renderCityAliasAdminTools() {
    const host = $('#accountContent');
    if (!host || $('#cityAliasTools'))
      return;
    const section = document.createElement('section');
    section.id = 'cityAliasTools';
    section.className = 'crew-tools';
    section.innerHTML = `
    <h3>City name aliases</h3>
    <p class="hint">Connect alternative city names to one canonical city. For example, add Bangalore as an alias of Bengaluru.</p>
    <form id="cityAliasForm" class="admin-form">
      <label>Canonical city
        <input name="canonical" placeholder="e.g. Bengaluru" required>
      </label>
      <label>Alternative names
        <input name="aliases" placeholder="e.g. Bangalore, Bangaluru">
      </label>
      <button class="btn green">Save city aliases</button>
    </form>
    <div id="cityAliasList"></div>
  `;
    host.appendChild(section);
    function renderAliasList() {
      $('#cityAliasList').innerHTML = Object.entries(db.cityAliases || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([canonical, aliases]) => `
        <div class="account-card">
          <b>${escape(canonical)}</b>
          <p>${(Array.isArray(aliases) ? aliases : []).map(escape).join(' · ') || 'No alternative names added'}</p>
          <button class="mini" type="button" data-remove-city-alias="${escape(canonical)}">Remove alias group</button>
        </div>
      `).join('') || '<p>No city aliases configured.</p>';
      $$('[data-remove-city-alias]').forEach(button => {
        button.onclick = () => {
          const city = button.dataset.removeCityAlias;
          if (!confirm(`Remove aliases for ${city}?`))
            return;
          delete db.cityAliases[city];
          save();
          refreshCities();
          renderAliasList();
          toast('City aliases updated.');

        };

      });

    }
    $('#cityAliasForm').onsubmit = event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const canonical = String(form.get('canonical') || '').trim();
      const aliases = [...new Set(String(form.get('aliases') || '')
        .split(',')
        .map(alias => alias.trim())
        .filter(Boolean))].filter(alias => normalizeCityName(alias) !== normalizeCityName(canonical));
      if (!canonical)
        return toast('Enter a canonical city name.');
      db.cityAliases[canonical] = aliases;
      save();
      refreshCities();
      event.currentTarget.reset();
      renderAliasList();
      toast('City aliases saved.');

    };
    renderAliasList();

  }
  function showCrewAccount() {
    const u = currentUser();
    if (!u || u.role !== 'crew')
      return;
    const crew = db.crews.find(c => c.id === u.crewId);
    if (!crew || crew.active === false) {
      toast('Crew account is inactive. Contact an administrator.');
      db.current = null;
      save();
      updateHeader();
      return;

    }
    const assignments = db.assignments.filter(a => a.driverId === crew.id || a.conductorId === crew.id);
    const cards = assignments.map(a => {
      const s = db.services.find(x => x.id === a.serviceId);
      if (!s)
        return '';
      const bookings = db.bookings.filter(b => b.serviceId === s.id && b.status === 'Confirmed');
      return `<article class="account-card"><h3>${escape(s.from)} → ${escape(s.to)} <span class="badge">${escape(a.serviceStatus || s.status)}</span></h3><p>${escape(s.code)} · ${escape(s.bus)} · ${escape(s.date)} · ${escape(s.depart)}–${escape(s.arrive)}<br>Depot: ${escape(s.depot || crew.depot)} · Passengers: ${bookings.length}<br>Actual departure: ${s.actualDepartAt ? new Date(s.actualDepartAt).toLocaleString() : 'Not recorded'} · Actual arrival: ${s.actualArriveAt ? new Date(s.actualArriveAt).toLocaleString() : 'Not recorded'}<br>Driver: ${escape(db.crews.find(c => c.id === a.driverId)?.name || 'Not assigned')} · Conductor: ${escape(db.crews.find(c => c.id === a.conductorId)?.name || 'Not assigned')}</p>${crew.designation === 'Conductor' ? `<button class="mini" data-crew-manifest="${s.id}">Open passenger manifest & boarding</button><button class="mini" data-trip-action="boarding" data-service="${s.id}">Start boarding</button>` : `<button class="mini" data-trip-action="checkin" data-service="${s.id}">Check in</button><button class="mini" data-trip-action="depart" data-service="${s.id}">Mark departed</button><button class="mini" data-trip-action="arrive" data-service="${s.id}">Mark arrived</button><button class="mini" data-trip-action="complete" data-service="${s.id}">Complete trip</button>`}<button class="mini" data-trip-action="delay" data-service="${s.id}">Report delay</button><button class="mini" data-trip-action="incident" data-service="${s.id}">Report incident / breakdown</button></article>`;

    }).join('');
    $('#accountEyebrow').textContent = 'AUTHORISED CREW PORTAL';
    $('#accountTitle').textContent = 'Crew dashboard';
    $('#accountContent').innerHTML = `<div class="crew-id-card"><span class="eyebrow">DIGITAL CREW ID</span><h3>${escape(crew.name)}</h3><p>${escape(crew.designation)} · ${escape(crew.employeeId)}</p><p>${escape(crew.phone)} · ${escape(crew.email)}<br>${escape(crew.depot)}</p></div><h3>Assigned trips</h3>${cards || '<p class="empty">No trips are currently assigned to you.</p>'}<h3>Trip activity history</h3>${db.tripLogs.filter(l => l.crewId === crew.id).slice().reverse().map(l => `<div class="account-card"><b>${escape(l.action)}</b><p>${escape(l.serviceCode)} · ${new Date(l.at).toLocaleString()}<br>${escape(l.note || '')}</p></div>`).join('') || '<p>No activity recorded yet.</p>'}<button class="mini" id="logout">Sign out</button>`;
    $$('[data-crew-manifest]').forEach(b => b.onclick = () => showCrewManifest(+b.dataset.crewManifest));
    $$('[data-trip-action]').forEach(b => b.onclick = () => recordTripAction(crew, +b.dataset.service, b.dataset.tripAction));
    $('#logout').onclick = () => {
      db.current = null;
      save();
      updateHeader();
      closeAll();
      toast('Signed out.');

    };
    open('accountModal');

  }
  function recordTripAction(crew, serviceId, action) {
    const service = db.services.find(s => s.id === serviceId), a = db.assignments.find(x => x.serviceId === serviceId);
    if (!service || !a)
      return;
    if ((crew.designation === 'Driver' && a.driverId !== crew.id) || (crew.designation === 'Conductor' && a.conductorId !== crew.id))
      return toast('You are not assigned to this service.');
    if (['checkin', 'depart', 'arrive', 'complete'].includes(action) && crew.designation !== 'Driver')
      return toast('Only the assigned driver can update this trip stage.');
    if (action === 'boarding' && crew.designation !== 'Conductor')
      return toast('Only the assigned conductor can start boarding.');
    let note = '';
    if (['delay', 'incident'].includes(action)) {
      note = prompt(action === 'delay' ? 'Enter delay details:' : 'Describe the incident or vehicle issue:');
      if (note === null)
        return;
      if (!note.trim())
        return toast('Please enter a note.');

    }
    const states = { checkin: 'Checked in', boarding: 'Boarding', depart: 'Departed', arrive: 'Arrived', complete: 'Completed' };
    if (states[action]) {
      a.serviceStatus = states[action];
      if (action === 'boarding')
        service.status = 'Boarding';
      if (action === 'depart') {
        service.status = 'Departed';
        service.actualDepartAt = new Date().toISOString();

      }
      if (action === 'arrive') {
        service.status = 'Arrived';
        service.actualArriveAt = new Date().toISOString();

      }
      if (action === 'complete') {
        service.status = 'Completed';
        a.checkedOutAt = new Date().toISOString();

      }
      if (action === 'checkin')
        a.checkedInAt = new Date().toISOString();

    }
    db.tripLogs.push({ crewId: crew.id, serviceId, serviceCode: service.code, action: states[action] || (action === 'delay' ? 'Delay reported' : 'Incident reported'), note, at: new Date().toISOString() });
    a.logs ||= [];
    a.logs.push(db.tripLogs.at(-1));
    save();
    refreshPublicInfo();
    showCrewAccount();
    toast('Trip update saved in this browser.');

  }
  function showCrewManifest(serviceId) {
    const u = currentUser(), crew = db.crews.find(c => c.id === u?.crewId);
    if (!crew || crew.designation !== 'Conductor')
      return toast('Only the assigned conductor can manage boarding.');
    const s = db.services.find(x => x.id === serviceId), a = db.assignments.find(x => x.serviceId === serviceId);
    if (!s || !a || a.conductorId !== crew.id)
      return toast('You are not the assigned conductor for this service.');
    const rows = db.bookings.filter(b => b.serviceId === serviceId && b.status === 'Confirmed').sort((a, b) => a.seat.localeCompare(b.seat, undefined, { numeric: true }));
    $('#accountEyebrow').textContent = 'CREW PORTAL · PASSENGER MANIFEST';
    $('#accountTitle').textContent = `${s.from} → ${s.to}`;
    $('#accountContent').innerHTML = `<div class="manifest-meta"><b>${escape(s.code)} · ${escape(s.bus)}</b><span>${escape(s.date)} · ${escape(s.depart)}–${escape(s.arrive)}</span></div><p class="hint">Passenger rows are read directly from confirmed bookings. Boarding checks are stored against the booking record.</p><div class="table-wrap"><table class="manifest-table"><thead><tr><th>Passenger</th><th>Seat</th><th>Boarding point</th><th>Drop point</th><th>Contact</th><th>Booking ref</th><th>Boarded</th></tr></thead><tbody>${rows.map(b => `<tr><td>${escape(b.passenger)}</td><td>${escape(b.seat)}</td><td>${escape(b.boarding || '—')}</td><td>${escape(b.drop || s.to || '—')}</td><td>${escape(b.phone || '—')} ${b.phone ? `<a href="tel:${escape(b.phone)}">Call</a>` : ''}</td><td>${escape(b.ref)}</td><td><input type="checkbox" data-boarded="${escape(b.ref)}" data-seat="${escape(b.seat)}" ${b.boarded ? 'checked' : ''} aria-label="Mark ${escape(b.passenger)} boarded"></td></tr>`).join('') || '<tr><td colspan="7" class="table-empty">No confirmed bookings.</td></tr>'}</tbody></table></div><button class="mini" id="backCrew">← Back to crew dashboard</button>`;
    $$('[data-boarded]').forEach(ch => ch.onchange = () => {
      const b = db.bookings.find(x => x.ref === ch.dataset.boarded && String(x.seat) === ch.dataset.seat);
      if (b) {
        b.boarded = ch.checked;
        b.boardedAt = ch.checked ? new Date().toISOString() : null;
        save();
        toast(ch.checked ? 'Passenger marked boarded.' : 'Boarding mark removed.');

      }

    });
    $('#backCrew').onclick = showCrewAccount;

  }
  function printTicket(b) {
    if (!b)
      return;
    const group = db.bookings.filter(x => x.ref === b.ref);
    const w = window.open('', '_blank', 'width=700,height=700');
    if (!w)
      return toast('Allow pop-ups to print your ticket.');
    const rows = group.map(x => `<tr><td>${escape(x.passenger)}</td><td>${escape(x.age || '—')}</td><td>${escape(x.seat)}</td><td>${escape(x.boarding)} → ${escape(x.drop || x.to)}</td><td>₹${Number(x.fare).toLocaleString('en-IN')}</td></tr>`).join('');
    const total = group.reduce((n, x) => n + Number(x.fare || 0), 0);
    w.document.write(`<html><head><title>Neo OPRS ticket ${escape(b.ref)}</title><style>body{font:15px Arial;padding:30px;color:#17251e}header{background:#12633f;color:white;padding:20px}h1{margin:0}section{border:1px solid #ccd9cf;padding:20px;margin-top:20px;line-height:1.8}table{width:100%;border-collapse:collapse;margin-top:15px}td,th{border:1px solid #ccd9cf;padding:9px;text-align:left}th{background:#edf5ef}.muted{color:#66766c;font-size:12px}</style></head><body><header><h1>KSRTC Swift</h1><p>PASSENGER BOOKING CONFIRMATION</p></header><section><h2>${escape(b.from)} → ${escape(b.to)}</h2><p><b>Journey date:</b> ${escape(b.date)}<br><b>Departure:</b> ${escape(b.depart)}<br><b>Bus:</b> ${escape(b.bus)} (${escape(b.code)})<br><b>Booking reference:</b> ${escape(b.ref)}<br><b>Passengers:</b> ${group.length}<br><b>Total fare:</b> ₹${total.toLocaleString('en-IN')}<br><b>Booking status:</b> ${escape(b.status)}<br><b>Payment status:</b> ${escape(b.paymentStatus || 'Pending')}</p><table><thead><tr><th>Passenger</th><th>Age</th><th>Seat</th><th>Boarding → Drop</th><th>Fare</th></tr></thead><tbody>${rows}</tbody></table></section><p class="muted">Independent booking confirmation. Not an official KSRTC ticket.</p><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();

  }
  $('#swap').onclick = () => {
    let a = $('#from').value;
    $('#from').value = $('#to').value;
    $('#to').value = a;

  };
  $('#roundTrip').onchange = () => $('#returnDate').required = $('#roundTrip').checked;
  $('#date').onchange = () => $('#returnDate').min = $('#date').value;
  $('#searchForm').onsubmit = e => {
    e.preventDefault();
    search = { from: $('#from').value.trim(), to: $('#to').value.trim(), date: $('#date').value, returnDate: $('#roundTrip').checked ? $('#returnDate').value : '' };
    if (canonicalCity(search.from) === canonicalCity(search.to))
      return toast('Choose two different cities.');
    if ($('#roundTrip').checked && !search.returnDate)
      return toast('Choose a return date.');
    renderServices();

  };
  $('#editSearch').onclick = () => $('#search').scrollIntoView({ behavior: 'smooth' });
  function renderServices() {
    const results = db.services.filter(s => s.status === 'Scheduled' && new Date(`${s.date}T${s.depart || '00:00'}:00`).getTime() > Date.now() && s.date === search.date && cityMatches(s.from, search.from) && cityMatches(s.to, search.to));
    $('#resultTitle').textContent = `${search.from} → ${search.to}`;
    $('#resultSub').textContent = `${search.date}${search.returnDate ? ' · Return ' + search.returnDate : ''} · ${results.length} service(s) found`;
    $('#serviceList').innerHTML = results.map(s => {
      let booked = db.bookings.filter(b => b.serviceId === s.id && b.status === 'Confirmed').map(b => b.seat);
      return `<article class="service"><div><strong>${escape(s.from)} → ${escape(s.to)}</strong><small>${escape(s.bus)} · ${escape(s.code)} · ${escape(s.depot)}</small></div><div><b>${escape(s.depart)} — ${escape(s.arrive)}</b><small>${escape(s.boarding)}</small><small>Rest stops: ${escape(s.stops || 'As scheduled')}</small></div><div><span class="fare">₹${Number(s.fare).toLocaleString('en-IN')}</span><small>${Math.max(0, seatInventory().length - booked.length)} seats available</small></div><button class="btn green" data-choose="${s.id}">Choose seat →</button></article>`;

    }).join('') || '<div class="empty">No matching services for this date. Try the sample routes: Bengaluru → Thalassery, Bengaluru → Kozhikode, or Thalassery → Bengaluru. An admin can add more services.</div>';
    $('#results').classList.remove('hidden');
    $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $$('[data-choose]').forEach(b => b.onclick = () => chooseService(+b.dataset.choose));

  }
  function chooseService(id) {
    if (!currentUser()) {
      setMode('login');
      open('authModal');
      return toast('Sign in or create an account to continue.');

    }
    activeService = db.services.find(s => s.id === id);
    selectedSeats = [];
    selectedFare = activeService.fare;
    $('#seatTitle').textContent = `${activeService.from} → ${activeService.to}`;
    $('#seatMeta').textContent = `${activeService.date} · ${activeService.depart} · ${activeService.bus} · ₹${activeService.fare}`;
    renderSeats();
    open('seatModal');

  }
  function renderSeats() {
    const taken = db.bookings.filter(b => b.serviceId === activeService.id && b.status === 'Confirmed').map(b => String(b.seat));
    let html = '';
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 4; col++) {
        if (col === 2)
          html += '<span class="seat-aisle" aria-hidden="true"></span>';
        const seat = String(row * 4 + col + (col > 1 ? 0 : 0) + 1), busy = taken.includes(seat), chosen = selectedSeats.includes(seat);
        html += `<button type="button" class="seat ${busy ? 'taken' : ''} ${chosen ? 'chosen' : ''}" data-seat="${seat}" ${busy ? 'disabled' : ''} aria-pressed="${chosen}" title="Seat ${seat}${busy ? ' — booked' : chosen ? ' — selected' : ''}">${seat}</button>`;

      }

    }
    html += '<div class="conductor-seat" aria-label="Reserved conductor seat — not bookable"><span>CREW</span><b>Reserved conductor seat</b></div>';
    $('#seatGrid').innerHTML = html;
    $('#selectedSeat').textContent = selectedSeats.length ? selectedSeats.join(', ') : 'None';
    $('#seatFare').textContent = '₹' + (selectedFare * selectedSeats.length).toLocaleString('en-IN');
    $('#continuePassenger').disabled = !selectedSeats.length;
    $$('[data-seat]').forEach(b => b.onclick = () => {
      const seat = b.dataset.seat;
      if (selectedSeats.includes(seat))
        selectedSeats = selectedSeats.filter(x => x !== seat);
      else if (selectedSeats.length >= 6) {
        toast('You can book a maximum of 6 seats per booking.');
        return;

      }
      else
        selectedSeats.push(seat);
      selectedSeats.sort((a, b) => Number(a) - Number(b));
      renderSeats();

    });

  }
  $('#continuePassenger').onclick = () => {
    if (!selectedSeats.length)
      return;
    closeAll();
    $('#passengerMeta').textContent = `${selectedSeats.length} passenger(s) · ${activeService.from} → ${activeService.to} · ${activeService.date} · ₹${(activeService.fare * selectedSeats.length).toLocaleString('en-IN')} total`;
    const options = String(activeService.boarding || activeService.from).split(',').map(x => x.trim()).filter(Boolean);
    const dropOptions = [...new Set([...(String(activeService.stops || '').split(',').map(x => x.trim()).filter(Boolean)), activeService.to])];
    const u = currentUser();
    $('#passengerFields').innerHTML = selectedSeats.map((seat, i) => `<fieldset class="passenger-entry"><legend>Passenger ${i + 1} · Seat ${seat}</legend><label>Full name<input name="name_${seat}" required value="${i === 0 ? escape(u?.name || '') : ''}"></label><div class="passenger-pair"><label>Age<input name="age_${seat}" type="number" min="1" max="120" required></label><label>Phone number<input name="phone_${seat}" type="tel" required value="${i === 0 ? escape(u?.phone || '') : ''}"></label></div><label>Email address<input name="email_${seat}" type="email" required value="${i === 0 ? escape(u?.email || '') : ''}"></label><label>Boarding point<select name="boarding_${seat}">${options.map(x => `<option>${escape(x)}</option>`).join('')}</select></label><label>Drop point<select name="drop_${seat}">${dropOptions.map(x => `<option ${x === activeService.to ? 'selected' : ''}>${escape(x)}</option>`).join('')}</select></label></fieldset>`).join('');
    open('passengerModal');

  };
  $('#passengerForm').onsubmit = e => {
    e.preventDefault();
    if (!currentUser())
      return toast('Please sign in again.');
    const taken = new Set(db.bookings.filter(b => b.serviceId === activeService.id && b.status === 'Confirmed').map(b => String(b.seat)));
    if (selectedSeats.some(seat => taken.has(seat))) {
      closeAll();
      toast('One of those seats was just booked. Please choose again.');
      chooseService(activeService.id);
      return;

    }
    const form = new FormData(e.currentTarget);
    const passengers = selectedSeats.map(seat => ({ seat, passenger: String(form.get(`name_${seat}`) || '').trim(), age: String(form.get(`age_${seat}`) || ''), phone: String(form.get(`phone_${seat}`) || '').trim(), email: String(form.get(`email_${seat}`) || '').trim(), boarding: String(form.get(`boarding_${seat}`) || ''), drop: String(form.get(`drop_${seat}`) || activeService.to) }));
    if (passengers.some(p => !p.passenger || !p.age || !p.phone || !p.email))
      return;
    window.passengerDraft = passengers;
    closeAll();
    renderPaymentSummary();
    $('#paymentStatus').textContent = '';
    $('#payNow').disabled = false;
    $('#payNow').textContent = 'Continue to secure payment →';
    open('paymentModal');

  };
  let paymentInProgress = false;
  function renderPaymentSummary() {
    const passengers = window.passengerDraft || [];
    const total = passengers.length * Number(activeService?.fare || 0);
    $('#paymentMeta').textContent = `${activeService.from} → ${activeService.to} · ${activeService.date}`;
    $('#paymentSummary').innerHTML = `
    <div class="payment-summary-row">
      <span>Journey</span>
      <strong>${escape(activeService.from)} → ${escape(activeService.to)}</strong>
    </div>
    <div class="payment-summary-row">
      <span>Travel date</span>
      <strong>${escape(activeService.date)}</strong>
    </div>
    <div class="payment-summary-row">
      <span>Service</span>
      <strong>${escape(activeService.bus)} · ${escape(activeService.code)}</strong>
    </div>
    <div class="payment-summary-row">
      <span>Selected seats</span>
      <strong>${selectedSeats.map(escape).join(', ')}</strong>
    </div>
    <div class="payment-passengers">
      <strong>Passenger details</strong>
      ${passengers.map(passenger => `
        <div>${escape(passenger.passenger)} · Seat ${escape(passenger.seat)} · ₹${Number(activeService.fare).toLocaleString('en-IN')}</div>
      `).join('')}
    </div>
    <div class="payment-total">
      <span>Total payable</span>
      <strong>₹${total.toLocaleString('en-IN')}</strong>
    </div>
  `;

  }
  function setPaymentStatus(message, state = '') {
    const status = $('#paymentStatus');
    status.textContent = message;
    status.className = `payment-status ${state}`.trim();

  }
  function loadRazorpayScript() {
    return new Promise((resolve, reject) => {
      if (window.Razorpay)
        return resolve();
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('The secure payment window could not be loaded.'));
      document.head.appendChild(script);

    });

  }
  async function beginSecurePayment() {
    if (paymentInProgress)
      return;
    const passengers = window.passengerDraft;
    if (!Array.isArray(passengers) || !passengers.length || !activeService || !selectedSeats.length) {
      return setPaymentStatus('Your booking details are incomplete. Please select your seats again.', 'error');

    }
    paymentInProgress = true;
    $('#payNow').disabled = true;
    $('#payNow').textContent = 'Connecting securely…';
    setPaymentStatus('Connecting to the secure payment service…', 'pending');
    try {
      const expectedAmount = passengers.length * Number(activeService.fare || 0);
      const orderResponse = await fetch(`${PAYMENT_API_BASE}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          serviceId: activeService.id,
          seats: selectedSeats,
          passengers,
          journeyDate: activeService.date,
          expectedAmount,
          currency: 'INR'
        })
      });
      if (!orderResponse.ok) {
        throw new Error('The payment service is unavailable. No booking has been confirmed.');

      }
      const order = await orderResponse.json();
      if (!order.orderId || !order.keyId || !order.amount || !order.currency) {
        throw new Error('The payment service returned an incomplete order. Please contact support.');

      }
      await loadRazorpayScript();
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'KSRTC Swift',
        description: `${activeService.from} to ${activeService.to}`,
        prefill: {
          name: passengers[0].passenger,
          email: passengers[0].email,
          contact: passengers[0].phone
        },
        notes: { serviceCode: activeService.code },
        handler: async (paymentResult) => {
          try {
            setPaymentStatus('Verifying your payment securely…', 'pending');
            const verifyResponse = await fetch(`${PAYMENT_API_BASE}/api/payments/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                orderId: paymentResult.razorpay_order_id,
                paymentId: paymentResult.razorpay_payment_id,
                signature: paymentResult.razorpay_signature
              })
            });
            const verification = await verifyResponse.json();
            if (!verifyResponse.ok || verification.verified !== true || !verification.bookingRef) {
              throw new Error('Payment verification could not be completed. Your booking is not confirmed.');

            }
            const bookingRef = verification.bookingRef;
            const transactionRef = paymentResult.razorpay_payment_id;
            passengers.forEach(passenger => {
              db.bookings.push({
                ref: bookingRef,
                user: db.current,
                ...passenger,
                serviceId: activeService.id,
                from: activeService.from,
                to: activeService.to,
                date: activeService.date,
                depart: activeService.depart,
                arrive: activeService.arrive,
                bus: activeService.bus,
                code: activeService.code,
                fare: Number(activeService.fare),
                status: 'Confirmed',
                paymentStatus: 'Paid',
                paymentMethod: 'Razorpay',
                transactionRef,
                boarded: false,
                created: new Date().toISOString()
              });

            });
            save();
            window.passengerDraft = null;
            selectedSeats = [];
            paymentInProgress = false;
            closeAll();
            toast(`Payment verified. Booking ${bookingRef} is confirmed.`);
            showAccount(false);

          }
          catch (error) {
            setPaymentStatus(error.message || 'Payment verification failed. Please contact support before retrying.', 'error');
            paymentInProgress = false;
            $('#payNow').disabled = false;
            $('#payNow').textContent = 'Retry secure payment →';

          }

        },
        modal: {
          ondismiss: () => {
            paymentInProgress = false;
            $('#payNow').disabled = false;
            $('#payNow').textContent = 'Retry secure payment →';
            setPaymentStatus('Payment was cancelled. No booking has been confirmed.', 'error');

          }
        },
        theme: { color: '#12633f' }
      });
      checkout.on('payment.failed', response => {
        paymentInProgress = false;
        $('#payNow').disabled = false;
        $('#payNow').textContent = 'Retry secure payment →';
        setPaymentStatus(response.error?.description || 'Payment was not completed. You can try again.', 'error');

      });
      checkout.open();
      $('#payNow').textContent = 'Payment window opened';

    }
    catch (error) {
      paymentInProgress = false;
      $('#payNow').disabled = false;
      $('#payNow').textContent = 'Retry secure payment →';
      setPaymentStatus(error.message || 'Unable to start payment. Please try again later.', 'error');

    }

  }
  $('#payNow').onclick = beginSecurePayment;
  updateHeader();
  save();
  refreshPublicInfo();
  setInterval(renderTimetable, 60000);

})();
