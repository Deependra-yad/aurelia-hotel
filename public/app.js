const state = {
  hotel: null,
  rooms: [],
  filter: "all",
  search: {
    checkIn: "",
    checkOut: "",
    adults: 2,
    children: 0,
    packageId: ""
  },
  booking: {
    step: 1,
    roomId: "",
    addOnIds: [],
    packageId: "",
    guest: {
      fullName: "",
      email: "",
      phone: "",
      arrivalTime: "3:00 PM"
    },
    specialRequests: "",
    paymentPreference: "pay_at_hotel",
    confirmedBooking: null
  }
};

const STORY_TABS = {
  architecture:
    "Triple-glazed acoustic stonework isolates every room from the avenue outside, while private French terraces open directly onto centuries-old Mediterranean cypress and our serene central reflecting pool.",
  butler:
    "Each floor is overseen by dedicated Clefs d'Or concierges and personal butlers available 24 hours a day—arranging anything from private museum dawn tours to bespoke pillow and scent menus.",
  location:
    "Positioned along the leafy Promenade des Arts, Aurelia places you three minutes from the waterfront harbor, flagship ateliers, and the city's finest concert halls."
};

const AMENITY_ICONS = {
  concierge: "✦",
  chauffeur: "◈",
  events: "❖",
  family: "♡",
  business: "▣",
  included: "✓"
};

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatReadableDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

function getNights() {
  if (!state.search.checkIn || !state.search.checkOut) return 1;
  const start = new Date(`${state.search.checkIn}T00:00:00`);
  const end = new Date(`${state.search.checkOut}T00:00:00`);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
}

function saveRecentBookingCode(code) {
  try {
    const existing = JSON.parse(localStorage.getItem("aurelia_booking_codes") || "[]");
    const updated = [code, ...existing.filter((c) => c !== code)].slice(0, 6);
    localStorage.setItem("aurelia_booking_codes", JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

function getRecentBookingCodes() {
  try {
    return JSON.parse(localStorage.getItem("aurelia_booking_codes") || "[]");
  } catch {
    return [];
  }
}

function initDefaultDates() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const checkout = new Date(tomorrow);
  checkout.setDate(tomorrow.getDate() + 3);

  state.search.checkIn = formatDateInput(tomorrow);
  state.search.checkOut = formatDateInput(checkout);

  const checkInEl = document.getElementById("quickCheckIn");
  const checkOutEl = document.getElementById("quickCheckOut");
  checkInEl.min = formatDateInput(today);
  checkInEl.value = state.search.checkIn;
  checkOutEl.min = formatDateInput(tomorrow);
  checkOutEl.value = state.search.checkOut;
}

async function fetchHotelAndAvailability() {
  if (!state.hotel) {
    const res = await fetch("/api/hotel");
    state.hotel = await res.json();
    renderStaticSections();
  }

  const totalGuests = Number(state.search.adults) + Number(state.search.children);
  const qs = new URLSearchParams({
    checkIn: state.search.checkIn,
    checkOut: state.search.checkOut,
    guests: String(totalGuests)
  });

  const availRes = await fetch(`/api/availability?${qs.toString()}`);
  const availData = await availRes.json();
  state.rooms = availData.rooms || [];

  if (!state.booking.roomId && state.rooms.length > 0) {
    const firstAvail = state.rooms.find((r) => r.availableCount > 0 && r.fitsGuests) || state.rooms[0];
    state.booking.roomId = firstAvail.id;
  }

  renderAvailabilitySummary();
  renderRoomsGrid();
}

function renderStaticSections() {
  const { brand, services, additionalServices, packages, testimonials, faqs } = state.hotel;

  if (brand) {
    if (brand.heroImage) document.getElementById("heroBgImage").src = brand.heroImage;
    if (brand.storyImage) document.getElementById("storyFeatureImage").src = brand.storyImage;
    if (brand.accolade && brand.address) {
      document.getElementById("heroAccolade").textContent = `${brand.accolade} · ${brand.address}`;
    }
    if (brand.name) {
      document.title = `${brand.name} — Architectural Sanctuary & Reservations`;
    }
    document.querySelectorAll(".brand-text strong").forEach((el) => {
      if (brand.shortName) el.textContent = brand.shortName.toUpperCase();
    });
    const footerBrandP = document.querySelector(".footer-brand p");
    if (footerBrandP) {
      footerBrandP.innerHTML = `${brand.address}<br />Reservations: ${brand.phone}<br />${brand.email}`;
    }
  }

  document.getElementById("signatureServicesGrid").innerHTML = services
    .map(
      (s) => `
      <article class="signature-card">
        <img src="${s.image}" alt="${s.title}" />
        <div class="signature-card-body">
          <div class="service-meta-row">
            <span>${s.category}</span>
            <span>${s.hours}</span>
          </div>
          <h3>${s.title}</h3>
          <p class="signature-subtitle">${s.subtitle}</p>
          <p class="signature-desc">${s.description}</p>
          <ul class="signature-list">
            ${s.highlights.map((h) => `<li>${h}</li>`).join("")}
          </ul>
        </div>
      </article>
    `
    )
    .join("");

  document.getElementById("additionalServicesGrid").innerHTML = additionalServices
    .map(
      (item) => `
      <div class="amenity-tile">
        <div class="amenity-icon" aria-hidden="true">${AMENITY_ICONS[item.icon] || "✦"}</div>
        <h4>${item.title}</h4>
        <p>${item.description}</p>
      </div>
    `
    )
    .join("");

  document.getElementById("packagesGrid").innerHTML = packages
    .map(
      (pkg) => `
      <article class="package-card">
        <span class="package-badge">${pkg.badge}</span>
        <h3>${pkg.title}</h3>
        <p>${pkg.description}</p>
        <div class="package-perk">${pkg.includedPerk}</div>
        <button type="button" class="btn-outline apply-package-btn" data-pkg="${pkg.id}">
          Book With This Offer
        </button>
      </article>
    `
    )
    .join("");

  document.getElementById("testimonialsGrid").innerHTML = testimonials
    .map(
      (t) => `
      <blockquote class="testimonial-card">
        <p class="testimonial-quote">“${t.quote}”</p>
        <footer class="testimonial-meta">
          <strong>${t.author}</strong>
          <span>${t.role} · ${t.stay}</span>
        </footer>
      </blockquote>
    `
    )
    .join("");

  document.getElementById("faqList").innerHTML = faqs
    .map(
      (f, i) => `
      <div class="faq-item ${i === 0 ? "open" : ""}">
        <button type="button" class="faq-question">
          <span>${f.q}</span>
          <span>${i === 0 ? "−" : "+"}</span>
        </button>
        <div class="faq-answer">${f.a}</div>
      </div>
    `
    )
    .join("");
}

function renderAvailabilitySummary() {
  const nights = getNights();
  const guests = Number(state.search.adults) + Number(state.search.children);
  document.getElementById("summaryDatesLabel").textContent =
    `${formatReadableDate(state.search.checkIn)} – ${formatReadableDate(state.search.checkOut)} (${nights} ${nights === 1 ? "night" : "nights"}, ${guests} ${guests === 1 ? "guest" : "guests"})`;
}

function renderRoomsGrid() {
  const filtered = state.rooms.filter((r) => state.filter === "all" || r.category === state.filter);
  const grid = document.getElementById("roomsGrid");

  grid.innerHTML = filtered
    .map((room) => {
      const totalGuests = Number(state.search.adults) + Number(state.search.children);
      const soldOut = room.availableCount < 1;
      const tooSmall = !room.fitsGuests;
      let statusLabel = `${room.availableCount} left for dates`;
      if (soldOut) statusLabel = "Sold out for dates";
      else if (tooSmall) statusLabel = `Max ${room.maxGuests} guests`;

      return `
      <article class="room-card">
        <div class="room-media">
          <img src="${room.image}" alt="${room.name}" />
          <span class="room-badge">${room.badge}</span>
          <span class="room-availability-pill ${soldOut || tooSmall ? "sold-out" : ""}">${statusLabel}</span>
        </div>
        <div class="room-body">
          <div class="room-top-row">
            <h3 class="room-name">${room.name}</h3>
            <div class="room-price">
              <strong>${formatCurrency(room.pricePerNight)}</strong>
              <span>per night · excl. tax</span>
            </div>
          </div>
          <p class="room-tagline">${room.tagline}</p>
          <div class="room-specs">
            <span>${room.sizeSqFt} sq ft (${room.sizeSqM} m²)</span>
            <span>·</span>
            <span>${room.bedType}</span>
            <span>·</span>
            <span>Up to ${room.maxGuests} guests</span>
          </div>
          <div class="room-actions">
            <button type="button" class="btn-outline view-room-btn" data-room="${room.id}">Room Details</button>
            <button type="button" class="btn-primary book-room-btn" data-room="${room.id}" ${soldOut || (tooSmall && totalGuests > room.maxGuests) ? "disabled" : ""}>
              ${soldOut ? "Unavailable" : "Reserve Suite"}
            </button>
          </div>
        </div>
      </article>
    `;
    })
    .join("");
}

function openModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".modal-backdrop.open")) {
    document.body.style.overflow = "";
  }
}

function openRoomDetailModal(roomId) {
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room) return;

  document.getElementById("roomModalBody").innerHTML = `
    <img class="room-detail-hero" src="${room.image}" alt="${room.name}" />
    <span class="section-kicker">${room.badge} · ${room.view}</span>
    <div class="room-top-row">
      <h2 id="roomModalTitle" style="font-family: var(--font-serif); font-size: 34px; margin: 0;">${room.name}</h2>
      <div class="room-price">
        <strong>${formatCurrency(room.pricePerNight)}</strong>
        <span>per night</span>
      </div>
    </div>
    <p style="color: var(--text-muted); margin-top: 10px;">${room.description}</p>
    <div class="room-specs">
      <span>Size: ${room.sizeSqFt} sq ft / ${room.sizeSqM} m²</span>
      <span>·</span>
      <span>Bedding: ${room.bedType}</span>
      <span>·</span>
      <span>Occupancy: Max ${room.maxGuests} guests</span>
    </div>
    <h4 style="margin: 18px 0 8px;">Included Suite Privileges &amp; Amenities</h4>
    <ul class="room-detail-amenities">
      ${room.amenities.map((a) => `<li>✓ ${a}</li>`).join("")}
    </ul>
    <div style="display: flex; justify-content: flex-end; gap: 12px;">
      <button type="button" class="btn-outline" data-close="roomModal">Close</button>
      <button type="button" class="btn-gold" id="modalReserveThisRoom" data-room="${room.id}">
        Book ${room.name}
      </button>
    </div>
  `;

  document.getElementById("modalReserveThisRoom").addEventListener("click", () => {
    closeModal("roomModal");
    startBookingFlow(room.id);
  });

  openModal("roomModal");
}

function computeClientPricing() {
  const room = state.rooms.find((r) => r.id === state.booking.roomId) || state.rooms[0];
  const nights = getNights();
  if (!room) return null;

  const baseRoomTotal = room.pricePerNight * nights;
  let discountAmount = 0;
  let appliedPackage = null;
  if (state.booking.packageId && state.hotel) {
    const pkg = state.hotel.packages.find((p) => p.id === state.booking.packageId);
    if (pkg && nights >= pkg.minNights) {
      appliedPackage = pkg;
      discountAmount = Math.round(baseRoomTotal * (pkg.discountPercent / 100));
    }
  }

  const discountedRoomTotal = baseRoomTotal - discountAmount;
  const selectedAddOns = state.booking.addOnIds
    .map((id) => state.hotel.addOns.find((a) => a.id === id))
    .filter(Boolean)
    .map((item) => ({
      ...item,
      totalPrice: item.pricingType === "per_night" ? item.price * nights : item.price
    }));

  const addOnsTotal = selectedAddOns.reduce((acc, a) => acc + a.totalPrice, 0);
  const subtotal = discountedRoomTotal + addOnsTotal;
  const taxes = Math.round(subtotal * (state.hotel?.brand?.taxRate || 0.12));
  const total = subtotal + taxes;

  return {
    room,
    nights,
    baseRoomTotal,
    appliedPackage,
    discountAmount,
    selectedAddOns,
    addOnsTotal,
    subtotal,
    taxes,
    total
  };
}

function startBookingFlow(roomId = "", packageId = "") {
  if (roomId) state.booking.roomId = roomId;
  state.booking.packageId = packageId !== "" ? packageId : state.search.packageId;
  state.booking.step = 1;
  state.booking.confirmedBooking = null;
  renderBookingModal();
  openModal("bookingModal");
}

function updateStepIndicator() {
  const dots = document.querySelectorAll("#stepIndicator .step-dot");
  dots.forEach((dot) => {
    const s = Number(dot.dataset.step);
    dot.classList.toggle("active", s === state.booking.step);
    dot.classList.toggle("done", s < state.booking.step);
  });
}

function renderBookingSummaryPane() {
  const pane = document.getElementById("bookingSummaryPane");
  if (state.booking.step === 4 && state.booking.confirmedBooking) {
    const b = state.booking.confirmedBooking;
    pane.innerHTML = `
      <img class="summary-room-thumb" src="${b.roomImage}" alt="${b.roomName}" />
      <h4 style="margin: 0 0 6px; font-family: var(--font-serif); font-size: 22px;">${b.roomName}</h4>
      <p class="muted-copy" style="margin: 0 0 14px;">
        ${formatReadableDate(b.checkIn)} → ${formatReadableDate(b.checkOut)} (${b.nights} ${b.nights === 1 ? "night" : "nights"})
      </p>
      <div class="summary-line"><span>Status</span><strong style="color: var(--success);">Confirmed</strong></div>
      <div class="summary-line"><span>Room Total</span><span>${formatCurrency(b.pricing.discountedRoomTotal)}</span></div>
      ${b.pricing.addOnsTotal ? `<div class="summary-line"><span>Enhancements</span><span>${formatCurrency(b.pricing.addOnsTotal)}</span></div>` : ""}
      <div class="summary-line muted"><span>Taxes &amp; Fees (12%)</span><span>${formatCurrency(b.pricing.taxes)}</span></div>
      <div class="summary-total"><span>Total Stay</span><strong>${formatCurrency(b.pricing.total)}</strong></div>
    `;
    return;
  }

  const p = computeClientPricing();
  if (!p) return;

  const pkgOptions = state.hotel.packages
    .map(
      (pkg) =>
        `<option value="${pkg.id}" ${state.booking.packageId === pkg.id ? "selected" : ""}>${pkg.title} (-${pkg.discountPercent}% · min ${pkg.minNights}n)</option>`
    )
    .join("");

  pane.innerHTML = `
    <img class="summary-room-thumb" src="${p.room.image}" alt="${p.room.name}" />
    <h4 style="margin: 0 0 4px; font-family: var(--font-serif); font-size: 22px;">${p.room.name}</h4>
    <p class="muted-copy" style="margin: 0 0 14px;">
      ${formatReadableDate(state.search.checkIn)} → ${formatReadableDate(state.search.checkOut)}<br />
      ${p.nights} ${p.nights === 1 ? "Night" : "Nights"} · ${state.search.adults} Adults${Number(state.search.children) ? `, ${state.search.children} Children` : ""}
    </p>

    <div class="field-group" style="margin-bottom: 14px;">
      <label for="summaryPackageSelect">Applied Offer / Package</label>
      <select id="summaryPackageSelect">
        <option value="">Best Flexible Rate</option>
        ${pkgOptions}
      </select>
    </div>

    <div class="summary-line">
      <span>${formatCurrency(p.room.pricePerNight)} × ${p.nights} ${p.nights === 1 ? "night" : "nights"}</span>
      <span>${formatCurrency(p.baseRoomTotal)}</span>
    </div>

    ${
      p.discountAmount > 0
        ? `<div class="summary-line discount"><span>${p.appliedPackage.title} (-${p.appliedPackage.discountPercent}%)</span><span>−${formatCurrency(p.discountAmount)}</span></div>`
        : ""
    }

    ${p.selectedAddOns
      .map(
        (a) =>
          `<div class="summary-line muted"><span>${a.name}</span><span>${formatCurrency(a.totalPrice)}</span></div>`
      )
      .join("")}

    <div class="summary-line muted">
      <span>Estimated Taxes &amp; Fees (12%)</span>
      <span>${formatCurrency(p.taxes)}</span>
    </div>

    <div class="summary-total">
      <span>Total Stay</span>
      <strong>${formatCurrency(p.total)}</strong>
    </div>
    <p class="muted-copy" style="font-size: 12px; margin: 10px 0 0;">
      Free cancellation up to 48 hours before arrival.
    </p>
  `;

  document.getElementById("summaryPackageSelect").addEventListener("change", (e) => {
    state.booking.packageId = e.target.value;
    renderBookingSummaryPane();
  });
}

function renderBookingModal() {
  updateStepIndicator();
  const main = document.getElementById("bookingMainPane");
  const totalGuests = Number(state.search.adults) + Number(state.search.children);

  if (state.booking.step === 1) {
    main.innerHTML = `
      <h3 style="font-family: var(--font-serif); font-size: 25px; margin: 0 0 14px;">1. Confirm Dates &amp; Suite</h3>
      <div class="form-row-2" style="margin-bottom: 18px;">
        <div class="field-group">
          <label for="modalCheckIn">Check-in Date</label>
          <input type="date" id="modalCheckIn" value="${state.search.checkIn}" />
        </div>
        <div class="field-group">
          <label for="modalCheckOut">Check-out Date</label>
          <input type="date" id="modalCheckOut" value="${state.search.checkOut}" />
        </div>
      </div>

      <div class="form-row-2" style="margin-bottom: 18px;">
        <div class="field-group">
          <label for="modalAdults">Adults</label>
          <select id="modalAdults">
            ${[1, 2, 3, 4].map((n) => `<option value="${n}" ${Number(state.search.adults) === n ? "selected" : ""}>${n} ${n === 1 ? "Adult" : "Adults"}</option>`).join("")}
          </select>
        </div>
        <div class="field-group">
          <label for="modalChildren">Children</label>
          <select id="modalChildren">
            ${[0, 1, 2].map((n) => `<option value="${n}" ${Number(state.search.children) === n ? "selected" : ""}>${n} ${n === 1 ? "Child" : "Children"}</option>`).join("")}
          </select>
        </div>
      </div>

      <h4 style="margin: 0 0 10px;">Select Accommodation</h4>
      <div class="room-select-list">
        ${state.rooms
          .map((r) => {
            const disabled = r.availableCount < 1 || totalGuests > r.maxGuests;
            const selected = r.id === state.booking.roomId;
            return `
            <div class="room-option-card ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}" data-select-room="${r.id}" data-disabled="${disabled}">
              <div class="room-option-left">
                <img src="${r.image}" alt="${r.name}" />
                <div>
                  <strong>${r.name}</strong>
                  <div class="muted-copy" style="font-size: 12.5px;">
                    ${r.sizeSqFt} sq ft · Max ${r.maxGuests} guests · ${r.availableCount < 1 ? "Sold out" : `${r.availableCount} left`}
                  </div>
                </div>
              </div>
              <div style="text-align: right;">
                <strong>${formatCurrency(r.pricePerNight)}</strong>
                <div class="muted-copy" style="font-size: 11.5px;">/ night</div>
              </div>
            </div>`;
          })
          .join("")}
      </div>

      <div class="booking-nav-btns">
        <span></span>
        <button type="button" class="btn-gold" id="toStep2Btn">Continue to Enhancements →</button>
      </div>
    `;

    const syncModalSearch = async () => {
      const ci = document.getElementById("modalCheckIn").value;
      const co = document.getElementById("modalCheckOut").value;
      if (ci && co && co > ci) {
        state.search.checkIn = ci;
        state.search.checkOut = co;
        document.getElementById("quickCheckIn").value = ci;
        document.getElementById("quickCheckOut").value = co;
      }
      state.search.adults = Number(document.getElementById("modalAdults").value);
      state.search.children = Number(document.getElementById("modalChildren").value);
      document.getElementById("quickAdults").value = String(state.search.adults);
      document.getElementById("quickChildren").value = String(state.search.children);
      await fetchHotelAndAvailability();
      renderBookingModal();
    };

    ["modalCheckIn", "modalCheckOut", "modalAdults", "modalChildren"].forEach((id) => {
      document.getElementById(id).addEventListener("change", syncModalSearch);
    });

    main.querySelectorAll("[data-select-room]").forEach((card) => {
      card.addEventListener("click", () => {
        if (card.dataset.disabled === "true") return;
        state.booking.roomId = card.dataset.selectRoom;
        renderBookingModal();
      });
    });

    document.getElementById("toStep2Btn").addEventListener("click", () => {
      state.booking.step = 2;
      renderBookingModal();
    });
  } else if (state.booking.step === 2) {
    main.innerHTML = `
      <h3 style="font-family: var(--font-serif); font-size: 25px; margin: 0 0 8px;">2. Curated Stay Enhancements</h3>
      <p class="muted-copy" style="margin: 0 0 18px;">Tailor your arrival with chauffeur transfers, thermal spa rituals, or tasting menus.</p>

      <div class="addon-list">
        ${state.hotel.addOns
          .map((a) => {
            const selected = state.booking.addOnIds.includes(a.id);
            const priceLabel = a.pricingType === "per_night" ? `${formatCurrency(a.price)} / night` : `${formatCurrency(a.price)} / stay`;
            return `
            <label class="addon-card ${selected ? "selected" : ""}">
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <input type="checkbox" class="addon-checkbox" value="${a.id}" ${selected ? "checked" : ""} style="margin-top: 4px;" />
                <div>
                  <strong>${a.name}</strong>
                  <div class="muted-copy" style="font-size: 13px;">${a.description}</div>
                </div>
              </div>
              <strong style="white-space: nowrap;">${priceLabel}</strong>
            </label>`;
          })
          .join("")}
      </div>

      <div class="booking-nav-btns">
        <button type="button" class="btn-outline" id="backToStep1Btn">← Back</button>
        <button type="button" class="btn-gold" id="toStep3Btn">Continue to Guest Details →</button>
      </div>
    `;

    main.querySelectorAll(".addon-checkbox").forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = cb.value;
        if (cb.checked) {
          if (!state.booking.addOnIds.includes(id)) state.booking.addOnIds.push(id);
        } else {
          state.booking.addOnIds = state.booking.addOnIds.filter((x) => x !== id);
        }
        cb.closest(".addon-card").classList.toggle("selected", cb.checked);
        renderBookingSummaryPane();
      });
    });

    document.getElementById("backToStep1Btn").addEventListener("click", () => {
      state.booking.step = 1;
      renderBookingModal();
    });
    document.getElementById("toStep3Btn").addEventListener("click", () => {
      state.booking.step = 3;
      renderBookingModal();
    });
  } else if (state.booking.step === 3) {
    const g = state.booking.guest;
    main.innerHTML = `
      <h3 style="font-family: var(--font-serif); font-size: 25px; margin: 0 0 8px;">3. Guest Details &amp; Guarantee</h3>
      <p class="muted-copy" style="margin: 0 0 18px;">Instant confirmation with flexible 48-hour cancellation.</p>

      <form id="finalBookingForm" style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-row-2">
          <div class="field-group">
            <label for="guestName">Full Name *</label>
            <input type="text" id="guestName" required value="${g.fullName}" placeholder="Alexander Sterling" />
          </div>
          <div class="field-group">
            <label for="guestEmail">Email Address *</label>
            <input type="email" id="guestEmail" required value="${g.email}" placeholder="alex@example.com" />
          </div>
        </div>

        <div class="form-row-2">
          <div class="field-group">
            <label for="guestPhone">Mobile Phone *</label>
            <input type="tel" id="guestPhone" required value="${g.phone}" placeholder="+1 555 234 5678" />
          </div>
          <div class="field-group">
            <label for="guestArrival">Estimated Arrival Time</label>
            <select id="guestArrival">
              ${["1:00 PM (Early Request)", "3:00 PM", "5:00 PM", "7:00 PM", "9:00 PM or Later"]
                .map((t) => `<option value="${t}" ${g.arrivalTime === t ? "selected" : ""}>${t}</option>`)
                .join("")}
            </select>
          </div>
        </div>

        <div class="field-group">
          <label for="paymentPref">Payment Option</label>
          <select id="paymentPref">
            <option value="pay_at_hotel" ${state.booking.paymentPreference === "pay_at_hotel" ? "selected" : ""}>Pay at Hotel Upon Arrival (No Deposit Required)</option>
            <option value="card_hold" ${state.booking.paymentPreference === "card_hold" ? "selected" : ""}>Reserve Now · Settle via Corporate / Concierge Link</option>
          </select>
        </div>

        <div class="field-group">
          <label for="specialRequests">Special Requests (Allergies, Pillows, Occasion)</label>
          <textarea id="specialRequests" rows="3" placeholder="Hypoallergenic pillows, anniversary celebration, quiet courtyard floor...">${state.booking.specialRequests}</textarea>
        </div>

        <div id="bookingErrorBox" class="form-feedback err"></div>

        <div class="booking-nav-btns">
          <button type="button" class="btn-outline" id="backToStep2Btn">← Back</button>
          <button type="submit" class="btn-gold" id="confirmBookingSubmitBtn">Confirm Reservation</button>
        </div>
      </form>
    `;

    document.getElementById("backToStep2Btn").addEventListener("click", () => {
      state.booking.step = 2;
      renderBookingModal();
    });

    document.getElementById("finalBookingForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errBox = document.getElementById("bookingErrorBox");
      errBox.textContent = "";

      state.booking.guest = {
        fullName: document.getElementById("guestName").value.trim(),
        email: document.getElementById("guestEmail").value.trim(),
        phone: document.getElementById("guestPhone").value.trim(),
        arrivalTime: document.getElementById("guestArrival").value
      };
      state.booking.paymentPreference = document.getElementById("paymentPref").value;
      state.booking.specialRequests = document.getElementById("specialRequests").value.trim();

      const btn = document.getElementById("confirmBookingSubmitBtn");
      btn.disabled = true;
      btn.textContent = "Confirming Stay...";

      try {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: state.booking.roomId,
            checkIn: state.search.checkIn,
            checkOut: state.search.checkOut,
            adults: state.search.adults,
            children: state.search.children,
            addOnIds: state.booking.addOnIds,
            packageId: state.booking.packageId,
            guest: state.booking.guest,
            specialRequests: state.booking.specialRequests,
            paymentPreference: state.booking.paymentPreference
          })
        });
        const data = await res.json();
        if (!res.ok) {
          errBox.textContent = data.error || "Unable to complete booking.";
          btn.disabled = false;
          btn.textContent = "Confirm Reservation";
          return;
        }

        state.booking.confirmedBooking = data.booking;
        saveRecentBookingCode(data.booking.confirmationCode);
        state.booking.step = 4;
        await fetchHotelAndAvailability();
        renderBookingModal();
      } catch {
        errBox.textContent = "Network error while confirming reservation.";
        btn.disabled = false;
        btn.textContent = "Confirm Reservation";
      }
    });
  } else if (state.booking.step === 4 && state.booking.confirmedBooking) {
    const b = state.booking.confirmedBooking;
    main.innerHTML = `
      <div class="confirmation-box">
        <span class="section-kicker" style="color: var(--success);">Reservation Confirmed</span>
        <h3 style="font-family: var(--font-serif); font-size: 32px; margin: 0;">We Look Forward to Welcoming You, ${b.guest.fullName}</h3>
        <div class="conf-code-pill">${b.confirmationCode}</div>
        <p class="muted-copy">
          Your suite at <strong>Aurelia Grand Hotel &amp; Spa</strong> is reserved. Keep your confirmation code above to inspect or manage your stay anytime.
        </p>

        <div style="margin-top: 18px; border-top: 1px solid var(--border); padding-top: 16px;">
          <div class="summary-line"><span>Suite</span><strong>${b.roomName}</strong></div>
          <div class="summary-line"><span>Dates</span><span>${formatReadableDate(b.checkIn)} – ${formatReadableDate(b.checkOut)} (${b.nights} nights)</span></div>
          <div class="summary-line"><span>Guests</span><span>${b.adults} Adults${b.children ? `, ${b.children} Children` : ""}</span></div>
          <div class="summary-line"><span>Arrival</span><span>${b.guest.arrivalTime}</span></div>
          <div class="summary-line"><span>Email</span><span>${b.guest.email}</span></div>
        </div>

        <div class="booking-nav-btns">
          <button type="button" class="btn-outline" onclick="window.print()">Print Confirmation</button>
          <button type="button" class="btn-primary" data-close="bookingModal">Done</button>
        </div>
      </div>
    `;
  }

  renderBookingSummaryPane();
}

async function lookupReservation(code) {
  const resultBox = document.getElementById("manageResultBox");
  resultBox.innerHTML = `<p class="muted-copy">Searching reservations...</p>`;
  try {
    const res = await fetch(`/api/bookings/${encodeURIComponent(code.trim().toUpperCase())}`);
    const data = await res.json();
    if (!res.ok) {
      resultBox.innerHTML = `<p class="form-feedback err">${data.error}</p>`;
      return;
    }
    const b = data.booking;
    resultBox.innerHTML = `
      <div class="confirmation-box" style="margin-top: 12px;">
        <span class="status-badge ${b.status}">${b.status}</span>
        <h4 style="font-family: var(--font-serif); font-size: 24px; margin: 0 0 6px;">${b.roomName}</h4>
        <p class="muted-copy" style="margin: 0 0 14px;">
          Confirmation <strong>${b.confirmationCode}</strong> · Guest: ${b.guest.fullName}
        </p>
        <div class="summary-line"><span>Check-in</span><span>${formatReadableDate(b.checkIn)}</span></div>
        <div class="summary-line"><span>Check-out</span><span>${formatReadableDate(b.checkOut)}</span></div>
        <div class="summary-line"><span>Total Stay</span><strong>${formatCurrency(b.pricing.total)}</strong></div>
        ${
          b.status === "confirmed"
            ? `<div style="margin-top: 16px; display: flex; justify-content: flex-end;">
                 <button type="button" class="btn-outline" style="color: var(--danger); border-color: var(--danger);" id="cancelResBtn" data-code="${b.confirmationCode}">
                   Cancel Reservation
                 </button>
               </div>`
            : ""
        }
      </div>
    `;

    const cancelBtn = document.getElementById("cancelResBtn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", async () => {
        cancelBtn.disabled = true;
        cancelBtn.textContent = "Cancelling...";
        await fetch(`/api/bookings/${encodeURIComponent(b.confirmationCode)}/cancel`, { method: "PATCH" });
        await fetchHotelAndAvailability();
        await lookupReservation(b.confirmationCode);
      });
    }
  } catch {
    resultBox.innerHTML = `<p class="form-feedback err">Could not look up reservation.</p>`;
  }
}

function openManageBookingModal() {
  const recent = getRecentBookingCodes();
  const recentBox = document.getElementById("recentCodesBox");
  recentBox.innerHTML = recent.length
    ? `<span class="muted-copy" style="font-size: 12px; width: 100%;">Recent bookings on this browser:</span>` +
      recent.map((c) => `<button type="button" class="code-chip" data-chip-code="${c}">${c}</button>`).join("")
    : "";

  recentBox.querySelectorAll("[data-chip-code]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("lookupCodeInput").value = btn.dataset.chipCode;
      lookupReservation(btn.dataset.chipCode);
    });
  });

  document.getElementById("manageResultBox").innerHTML = "";
  openModal("manageModal");
}

function bindGlobalEvents() {
  // Header scroll state
  const header = document.getElementById("siteHeader");
  const onScroll = () => {
    header.classList.toggle("scrolled", window.scrollY > 40);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile menu
  document.getElementById("mobileMenuBtn").addEventListener("click", () => {
    const nav = document.getElementById("mainNav");
    const open = nav.classList.toggle("mobile-open");
    document.getElementById("mobileMenuBtn").setAttribute("aria-expanded", String(open));
  });

  // Story tabs
  document.querySelectorAll(".story-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".story-tab").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      document.getElementById("storyTabPanel").innerHTML = `<p>${STORY_TABS[btn.dataset.tab]}</p>`;
    });
  });

  // Room filters
  document.querySelectorAll(".filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      state.filter = pill.dataset.filter;
      renderRoomsGrid();
    });
  });

  // Quick booking search bar
  document.getElementById("quickCheckIn").addEventListener("change", (e) => {
    const ci = e.target.value;
    const coEl = document.getElementById("quickCheckOut");
    if (coEl.value <= ci) {
      const next = new Date(`${ci}T00:00:00`);
      next.setDate(next.getDate() + 1);
      coEl.value = formatDateInput(next);
    }
    coEl.min = ci;
  });

  document.getElementById("quickSearchForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    state.search.checkIn = document.getElementById("quickCheckIn").value;
    state.search.checkOut = document.getElementById("quickCheckOut").value;
    state.search.adults = Number(document.getElementById("quickAdults").value);
    state.search.children = Number(document.getElementById("quickChildren").value);
    state.search.packageId = document.getElementById("quickPackage").value;
    await fetchHotelAndAvailability();
    document.getElementById("rooms").scrollIntoView({ behavior: "smooth" });
  });

  // Delegated room card & package & FAQ actions
  document.addEventListener("click", (e) => {
    const viewBtn = e.target.closest(".view-room-btn");
    if (viewBtn) {
      openRoomDetailModal(viewBtn.dataset.room);
      return;
    }

    const bookBtn = e.target.closest(".book-room-btn");
    if (bookBtn && !bookBtn.disabled) {
      startBookingFlow(bookBtn.dataset.room);
      return;
    }

    const pkgBtn = e.target.closest(".apply-package-btn");
    if (pkgBtn) {
      startBookingFlow("", pkgBtn.dataset.pkg);
      return;
    }

    const faqBtn = e.target.closest(".faq-question");
    if (faqBtn) {
      const item = faqBtn.closest(".faq-item");
      const open = item.classList.toggle("open");
      faqBtn.querySelector("span:last-child").textContent = open ? "−" : "+";
      return;
    }

    const closeBtn = e.target.closest("[data-close]");
    if (closeBtn) {
      closeModal(closeBtn.dataset.close);
      return;
    }

    if (e.target.classList.contains("modal-backdrop")) {
      closeModal(e.target.id);
    }
  });

  // Top & footer booking triggers
  ["openBookingTopBtn", "footerBookBtn"].forEach((id) => {
    document.getElementById(id).addEventListener("click", () => startBookingFlow());
  });
  ["openManageBtn", "footerManageBtn"].forEach((id) => {
    document.getElementById(id).addEventListener("click", openManageBookingModal);
  });

  // Lookup booking form
  document.getElementById("lookupBookingForm").addEventListener("submit", (e) => {
    e.preventDefault();
    lookupReservation(document.getElementById("lookupCodeInput").value);
  });

  // Concierge inquiry form
  document.getElementById("conciergeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const feedback = document.getElementById("conciergeFeedback");
    feedback.className = "form-feedback";
    feedback.textContent = "Sending to concierge desk...";

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: document.getElementById("inqName").value,
          email: document.getElementById("inqEmail").value,
          topic: document.getElementById("inqTopic").value,
          message: document.getElementById("inqMessage").value
        })
      });
      const data = await res.json();
      if (!res.ok) {
        feedback.className = "form-feedback err";
        feedback.textContent = data.error || "Unable to send inquiry.";
        return;
      }
      feedback.className = "form-feedback ok";
      feedback.textContent = `Received (${data.inquiry.id}). Our concierge team will respond within 2 hours.`;
      e.target.reset();
    } catch {
      feedback.className = "form-feedback err";
      feedback.textContent = "Network error while sending message.";
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initDefaultDates();
  bindGlobalEvents();
  await fetchHotelAndAvailability();
});
