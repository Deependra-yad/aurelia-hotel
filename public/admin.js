const adminState = {
  token: sessionStorage.getItem("aurelia_admin_token") || "",
  activeTab: "overview",
  overview: null
};

const TAB_TITLES = {
  overview: "Dashboard Overview",
  rooms: "Rooms, Inventory & Nightly Pricing",
  media: "Media Library & Image Uploads",
  offers: "Add-on Enhancements & Packages",
  brand: "Hotel Identity, Tax Rate & Services",
  bookings: "Guest Reservations & Concierge Inquiries"
};

function showToast(msg, isError = false) {
  const el = document.getElementById("toastMsg");
  el.textContent = msg;
  el.style.color = isError ? "var(--danger)" : "var(--success)";
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    el.textContent = "";
  }, 3500);
}

function money(val) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(val) || 0);
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminState.token,
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (res.status === 401) {
    sessionStorage.removeItem("aurelia_admin_token");
    adminState.token = "";
    showLoginScreen();
    throw new Error(data.error || "Session expired");
  }
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function showLoginScreen() {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("adminShell").classList.add("hidden");
}

function showAdminShell() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("adminShell").classList.remove("hidden");
}

async function loadOverview() {
  adminState.overview = await apiFetch("/api/admin/overview");
  renderActiveTab();
}

function renderActiveTab() {
  if (!adminState.overview) return;
  document.getElementById("pageTitle").textContent = TAB_TITLES[adminState.activeTab] || "Admin";
  document.querySelectorAll("#sideNav .nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === adminState.activeTab);
  });

  const container = document.getElementById("tabContent");
  const { config, bookings, inquiries, images, stats } = adminState.overview;

  if (adminState.activeTab === "overview") {
    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <span>Confirmed Revenue</span>
          <strong>${money(stats.totalRevenue)}</strong>
        </div>
        <div class="kpi-card">
          <span>Active Reservations</span>
          <strong>${stats.confirmedCount}</strong>
        </div>
        <div class="kpi-card">
          <span>Total Suite Inventory</span>
          <strong>${stats.totalRoomsCount}</strong>
        </div>
        <div class="kpi-card">
          <span>Open Inquiries</span>
          <strong>${stats.openInquiriesCount}</strong>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-header">
          <h3>Recent Reservations</h3>
          <button type="button" class="btn-outline" id="goBookingsTabBtn">Manage All Reservations</button>
        </div>
        ${
          bookings.length === 0
            ? `<p style="color: var(--muted);">No reservations recorded yet. Bookings made on the public site appear here immediately.</p>`
            : `<table class="data-table">
                <thead>
                  <tr><th>Code</th><th>Guest</th><th>Suite</th><th>Dates</th><th>Total</th><th>Status</th></tr>
                </thead>
                <tbody>
                  ${bookings
                    .slice(0, 6)
                    .map(
                      (b) => `<tr>
                        <td><code>${b.confirmationCode}</code></td>
                        <td>${b.guest?.fullName || ""}</td>
                        <td>${b.roomName}</td>
                        <td>${b.checkIn} → ${b.checkOut}</td>
                        <td><strong>${money(b.pricing?.total)}</strong></td>
                        <td><span class="status-pill ${b.status}">${b.status}</span></td>
                      </tr>`
                    )
                    .join("")}
                </tbody>
              </table>`
        }
      </div>
    `;

    document.getElementById("goBookingsTabBtn").addEventListener("click", () => {
      adminState.activeTab = "bookings";
      renderActiveTab();
    });
  } else if (adminState.activeTab === "rooms") {
    container.innerHTML = `
      <div class="panel-header">
        <h3>Accommodations (${config.rooms.length} Categories)</h3>
        <button type="button" class="btn-gold" id="addRoomBtn">+ Add New Room / Suite</button>
      </div>
      <div class="rooms-admin-grid">
        ${config.rooms
          .map(
            (r) => `
          <article class="room-admin-card">
            <img src="${r.image}" alt="${r.name}" />
            <div class="room-admin-body">
              <div class="room-admin-top">
                <div>
                  <h4>${r.name}</h4>
                  <small style="color: var(--muted);">${r.category.toUpperCase()} · ${r.sizeSqFt} sq ft · Max ${r.maxGuests} guests</small>
                </div>
                <span class="price-pill">${money(r.pricePerNight)} / night</span>
              </div>

              <div class="quick-price-row">
                <label style="font-size: 12px; font-weight: 600;">Rate $</label>
                <input type="number" min="1" value="${r.pricePerNight}" id="qp-price-${r.id}" />
                <label style="font-size: 12px; font-weight: 600;">Units</label>
                <input type="number" min="0" value="${r.inventory}" id="qp-inv-${r.id}" style="width: 66px;" />
                <button type="button" class="btn-primary quick-save-room" data-room-id="${r.id}">Save</button>
              </div>

              <div style="display: flex; gap: 8px; margin-top: auto;">
                <button type="button" class="btn-outline edit-room-btn" data-room-id="${r.id}" style="flex: 1;">Edit Full Details &amp; Image</button>
                <button type="button" class="btn-danger delete-room-btn" data-room-id="${r.id}">Delete</button>
              </div>
            </div>
          </article>
        `
          )
          .join("")}
      </div>
    `;

    document.getElementById("addRoomBtn").addEventListener("click", () => openRoomEditor(null));

    container.querySelectorAll(".quick-save-room").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.roomId;
        const pricePerNight = Number(document.getElementById(`qp-price-${id}`).value);
        const inventory = Number(document.getElementById(`qp-inv-${id}`).value);
        try {
          await apiFetch(`/api/admin/rooms/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({ pricePerNight, inventory })
          });
          showToast("Room rate & inventory updated live!");
          await loadOverview();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    });

    container.querySelectorAll(".edit-room-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const room = config.rooms.find((r) => r.id === btn.dataset.roomId);
        if (room) openRoomEditor(room);
      });
    });

    container.querySelectorAll(".delete-room-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.roomId;
        try {
          await apiFetch(`/api/admin/rooms/${encodeURIComponent(id)}`, { method: "DELETE" });
          showToast("Room category removed.");
          await loadOverview();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    });
  } else if (adminState.activeTab === "media") {
    container.innerHTML = `
      <div class="upload-zone">
        <h3 style="font-family: var(--serif); font-size: 26px; margin: 0 0 6px;">Upload New Hotel Photography</h3>
        <p style="color: var(--muted); margin: 0 0 16px;">Select PNG, JPG, or WEBP files from your computer. Uploaded images become immediately available for Hero, Story, Rooms, and Services.</p>
        <input type="file" id="imageUploadInput" accept="image/png,image/jpeg,image/webp" style="display: none;" />
        <button type="button" class="btn-gold" id="triggerUploadBtn">Choose Image to Upload</button>
      </div>

      <div class="panel-header">
        <h3>Media Library (${images.length} Images)</h3>
      </div>

      <div class="media-grid">
        ${images
          .map(
            (img) => `
          <div class="media-card">
            <img src="${img.url}" alt="${img.name}" />
            <div class="media-meta">
              <strong>${img.name}</strong>
              <code>${img.url}</code>
              <div class="media-actions">
                <button type="button" class="btn-outline set-hero-btn" data-url="${img.url}">Set Hero</button>
                <button type="button" class="btn-outline set-story-btn" data-url="${img.url}">Set Story</button>
                ${
                  img.isUploaded
                    ? `<button type="button" class="btn-danger delete-img-btn" data-name="${img.name}">Delete</button>`
                    : ""
                }
              </div>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;

    const fileInput = document.getElementById("imageUploadInput");
    document.getElementById("triggerUploadBtn").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await apiFetch("/api/admin/upload", {
            method: "POST",
            body: JSON.stringify({ filename: file.name, dataUrl: reader.result })
          });
          showToast(`Uploaded ${file.name} to Media Library!`);
          await loadOverview();
        } catch (err) {
          showToast(err.message, true);
        }
      };
      reader.readAsDataURL(file);
    });

    container.querySelectorAll(".set-hero-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await apiFetch("/api/admin/brand", {
          method: "PUT",
          body: JSON.stringify({ heroImage: btn.dataset.url })
        });
        showToast("Hero background image updated!");
        await loadOverview();
      });
    });

    container.querySelectorAll(".set-story-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await apiFetch("/api/admin/brand", {
          method: "PUT",
          body: JSON.stringify({ storyImage: btn.dataset.url })
        });
        showToast("Hotel Story image updated!");
        await loadOverview();
      });
    });

    container.querySelectorAll(".delete-img-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await apiFetch(`/api/admin/images/${encodeURIComponent(btn.dataset.name)}`, { method: "DELETE" });
        showToast("Uploaded image deleted.");
        await loadOverview();
      });
    });
  } else if (adminState.activeTab === "offers") {
    container.innerHTML = `
      <form id="pricingRulesForm" class="form-stack">
        <div class="panel-card">
          <div class="panel-header">
            <h3>Stay Enhancements (Add-ons Pricing)</h3>
          </div>
          <div class="form-stack">
            ${config.addOns
              .map(
                (a, idx) => `
              <div class="grid-3" style="padding: 12px; background: var(--bg); border-radius: 8px;">
                <div class="field">
                  <label>Add-on Name</label>
                  <input type="text" class="addon-name" data-idx="${idx}" value="${a.name}" required />
                </div>
                <div class="field">
                  <label>Price (USD)</label>
                  <input type="number" min="0" class="addon-price" data-idx="${idx}" value="${a.price}" required />
                </div>
                <div class="field">
                  <label>Billing Type</label>
                  <select class="addon-type" data-idx="${idx}">
                    <option value="per_night" ${a.pricingType === "per_night" ? "selected" : ""}>Per Night</option>
                    <option value="per_stay" ${a.pricingType === "per_stay" ? "selected" : ""}>Per Stay</option>
                  </select>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Seasonal Packages &amp; Discounts</h3>
          </div>
          <div class="form-stack">
            ${config.packages
              .map(
                (p, idx) => `
              <div class="grid-3" style="padding: 12px; background: var(--bg); border-radius: 8px;">
                <div class="field">
                  <label>Package Title</label>
                  <input type="text" class="pkg-title" data-idx="${idx}" value="${p.title}" required />
                </div>
                <div class="field">
                  <label>Discount (%)</label>
                  <input type="number" min="0" max="80" class="pkg-discount" data-idx="${idx}" value="${p.discountPercent}" required />
                </div>
                <div class="field">
                  <label>Minimum Nights</label>
                  <input type="number" min="1" max="30" class="pkg-nights" data-idx="${idx}" value="${p.minNights}" required />
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end;">
          <button type="submit" class="btn-gold">Save All Pricing &amp; Package Rules</button>
        </div>
      </form>
    `;

    document.getElementById("pricingRulesForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const updatedAddOns = config.addOns.map((a, idx) => ({
        ...a,
        name: container.querySelector(`.addon-name[data-idx="${idx}"]`).value,
        price: Number(container.querySelector(`.addon-price[data-idx="${idx}"]`).value),
        pricingType: container.querySelector(`.addon-type[data-idx="${idx}"]`).value
      }));
      const updatedPackages = config.packages.map((p, idx) => ({
        ...p,
        title: container.querySelector(`.pkg-title[data-idx="${idx}"]`).value,
        discountPercent: Number(container.querySelector(`.pkg-discount[data-idx="${idx}"]`).value),
        minNights: Number(container.querySelector(`.pkg-nights[data-idx="${idx}"]`).value)
      }));
      try {
        await apiFetch("/api/admin/pricing-rules", {
          method: "PUT",
          body: JSON.stringify({ addOns: updatedAddOns, packages: updatedPackages })
        });
        showToast("Add-on pricing and package discounts saved!");
        await loadOverview();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  } else if (adminState.activeTab === "brand") {
    const b = config.brand;
    const imgOpts = (selected) =>
      images
        .map((img) => `<option value="${img.url}" ${selected === img.url ? "selected" : ""}>${img.name} (${img.url})</option>`)
        .join("");

    container.innerHTML = `
      <form id="brandForm" class="panel-card form-stack" style="margin-bottom: 22px;">
        <div class="panel-header">
          <h3>Hotel Identity, Contact &amp; Tax Settings</h3>
          <button type="submit" class="btn-gold">Save Hotel Settings</button>
        </div>

        <div class="grid-2">
          <div class="field"><label>Full Hotel Name</label><input id="bName" value="${b.name}" required /></div>
          <div class="field"><label>Short Brand Wordmark</label><input id="bShort" value="${b.shortName}" required /></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Accolade / Eyebrow</label><input id="bAccolade" value="${b.accolade || ""}" /></div>
          <div class="field"><label>Street Address</label><input id="bAddress" value="${b.address}" /></div>
        </div>
        <div class="grid-3">
          <div class="field"><label>Reservations Phone</label><input id="bPhone" value="${b.phone}" /></div>
          <div class="field"><label>Concierge Email</label><input id="bEmail" value="${b.email}" /></div>
          <div class="field"><label>Tax Rate (e.g. 0.12 = 12%)</label><input id="bTax" type="number" step="0.01" min="0" max="0.5" value="${b.taxRate}" /></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Hero Background Image</label><select id="bHero">${imgOpts(b.heroImage)}</select></div>
          <div class="field"><label>Hotel Story Feature Image</label><select id="bStory">${imgOpts(b.storyImage)}</select></div>
        </div>
      </form>

      <div class="panel-card">
        <div class="panel-header">
          <h3>Signature Services (Dining &amp; Spa)</h3>
        </div>
        <div class="form-stack">
          ${config.services
            .map(
              (s) => `
            <div class="panel-card" style="background: var(--bg);">
              <div class="grid-2">
                <div class="field"><label>Service Title</label><input id="srv-title-${s.id}" value="${s.title}" /></div>
                <div class="field"><label>Operating Hours</label><input id="srv-hours-${s.id}" value="${s.hours}" /></div>
              </div>
              <div class="grid-2" style="margin-top: 10px;">
                <div class="field"><label>Subtitle</label><input id="srv-sub-${s.id}" value="${s.subtitle}" /></div>
                <div class="field"><label>Service Image</label><select id="srv-img-${s.id}">${imgOpts(s.image)}</select></div>
              </div>
              <div class="field" style="margin-top: 10px;">
                <label>Description</label>
                <textarea id="srv-desc-${s.id}" rows="2">${s.description}</textarea>
              </div>
              <div style="margin-top: 10px; text-align: right;">
                <button type="button" class="btn-primary save-service-btn" data-srv-id="${s.id}">Update Service</button>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;

    document.getElementById("brandForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await apiFetch("/api/admin/brand", {
          method: "PUT",
          body: JSON.stringify({
            name: document.getElementById("bName").value,
            shortName: document.getElementById("bShort").value,
            accolade: document.getElementById("bAccolade").value,
            address: document.getElementById("bAddress").value,
            phone: document.getElementById("bPhone").value,
            email: document.getElementById("bEmail").value,
            taxRate: Number(document.getElementById("bTax").value),
            heroImage: document.getElementById("bHero").value,
            storyImage: document.getElementById("bStory").value
          })
        });
        showToast("Hotel brand & settings updated live!");
        await loadOverview();
      } catch (err) {
        showToast(err.message, true);
      }
    });

    container.querySelectorAll(".save-service-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.srvId;
        try {
          await apiFetch(`/api/admin/services/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({
              title: document.getElementById(`srv-title-${id}`).value,
              hours: document.getElementById(`srv-hours-${id}`).value,
              subtitle: document.getElementById(`srv-sub-${id}`).value,
              image: document.getElementById(`srv-img-${id}`).value,
              description: document.getElementById(`srv-desc-${id}`).value
            })
          });
          showToast("Signature service updated!");
          await loadOverview();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    });
  } else if (adminState.activeTab === "bookings") {
    container.innerHTML = `
      <div class="panel-card" style="margin-bottom: 24px;">
        <div class="panel-header">
          <h3>All Guest Reservations (${bookings.length})</h3>
        </div>
        ${
          bookings.length === 0
            ? `<p style="color: var(--muted);">No reservations yet.</p>`
            : `<table class="data-table">
                <thead>
                  <tr><th>Code</th><th>Guest &amp; Contact</th><th>Suite</th><th>Dates</th><th>Total</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  ${bookings
                    .map(
                      (b) => `<tr>
                        <td><code>${b.confirmationCode}</code></td>
                        <td><strong>${b.guest?.fullName}</strong><br /><small>${b.guest?.email}</small></td>
                        <td>${b.roomName}</td>
                        <td>${b.checkIn} → ${b.checkOut} (${b.nights}n)</td>
                        <td><strong>${money(b.pricing?.total)}</strong></td>
                        <td><span class="status-pill ${b.status}">${b.status}</span></td>
                        <td>
                          <button type="button" class="btn-outline toggle-booking-btn" data-code="${b.confirmationCode}" data-next="${b.status === "confirmed" ? "cancelled" : "confirmed"}">
                            ${b.status === "confirmed" ? "Cancel" : "Restore"}
                          </button>
                        </td>
                      </tr>`
                    )
                    .join("")}
                </tbody>
              </table>`
        }
      </div>

      <div class="panel-card">
        <div class="panel-header">
          <h3>Concierge &amp; Event Inquiries (${inquiries.length})</h3>
        </div>
        ${
          inquiries.length === 0
            ? `<p style="color: var(--muted);">No concierge inquiries yet.</p>`
            : `<table class="data-table">
                <thead>
                  <tr><th>ID</th><th>Guest</th><th>Topic</th><th>Message</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  ${inquiries
                    .map(
                      (inq) => `<tr>
                        <td><code>${inq.id}</code></td>
                        <td><strong>${inq.name}</strong><br /><small>${inq.email}</small></td>
                        <td>${inq.topic}</td>
                        <td style="max-width: 320px;">${inq.message}</td>
                        <td><span class="status-pill ${inq.status === "resolved" ? "resolved" : "open"}">${inq.status || "open"}</span></td>
                        <td>
                          <button type="button" class="btn-outline toggle-inq-btn" data-id="${inq.id}" data-next="${inq.status === "resolved" ? "open" : "resolved"}">
                            ${inq.status === "resolved" ? "Reopen" : "Resolve"}
                          </button>
                        </td>
                      </tr>`
                    )
                    .join("")}
                </tbody>
              </table>`
        }
      </div>
    `;

    container.querySelectorAll(".toggle-booking-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await apiFetch(`/api/admin/bookings/${encodeURIComponent(btn.dataset.code)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: btn.dataset.next })
        });
        showToast(`Reservation ${btn.dataset.code} updated.`);
        await loadOverview();
      });
    });

    container.querySelectorAll(".toggle-inq-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await apiFetch(`/api/admin/inquiries/${encodeURIComponent(btn.dataset.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: btn.dataset.next })
        });
        showToast(`Inquiry ${btn.dataset.id} updated.`);
        await loadOverview();
      });
    });
  }
}

function openRoomEditor(room) {
  const images = adminState.overview?.images || [];
  const imgSelect = document.getElementById("editRoomImage");
  imgSelect.innerHTML = images
    .map((img) => `<option value="${img.url}">${img.name} (${img.url})</option>`)
    .join("");

  document.getElementById("roomEditorTitle").textContent = room ? `Edit: ${room.name}` : "Add New Room / Suite";
  document.getElementById("editRoomId").value = room ? room.id : "";
  document.getElementById("editRoomName").value = room ? room.name : "";
  document.getElementById("editRoomCategory").value = room ? room.category : "rooms";
  document.getElementById("editRoomPrice").value = room ? room.pricePerNight : 420;
  document.getElementById("editRoomInventory").value = room ? room.inventory : 4;
  document.getElementById("editRoomGuests").value = room ? room.maxGuests : 2;
  document.getElementById("editRoomSqFt").value = room ? room.sizeSqFt : 480;
  document.getElementById("editRoomBed").value = room ? room.bedType : "1 King Bed";
  document.getElementById("editRoomBadge").value = room ? room.badge : "New Suite";
  document.getElementById("editRoomView").value = room ? room.view : "Courtyard View";
  document.getElementById("editRoomImage").value = room ? room.image : (images[0]?.url || "/images/room-deluxe.jpg");
  document.getElementById("editRoomTagline").value = room ? room.tagline : "";
  document.getElementById("editRoomDesc").value = room ? room.description : "";
  document.getElementById("editRoomAmenities").value = room ? (room.amenities || []).join("\n") : "High-speed Wi-Fi\nLimestone rain shower\nEvening turndown service";

  document.getElementById("roomEditorModal").classList.add("open");
}

function closeRoomEditor() {
  document.getElementById("roomEditorModal").classList.remove("open");
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("loginError");
    errEl.textContent = "";
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: document.getElementById("adminPasscode").value })
      });
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.error || "Login failed";
        return;
      }
      adminState.token = data.token;
      sessionStorage.setItem("aurelia_admin_token", data.token);
      showAdminShell();
      await loadOverview();
    } catch {
      errEl.textContent = "Unable to connect to server.";
    }
  });

  document.querySelectorAll("#sideNav .nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      adminState.activeTab = btn.dataset.tab;
      renderActiveTab();
    });
  });

  document.getElementById("refreshAllBtn").addEventListener("click", loadOverview);
  document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("aurelia_admin_token");
    adminState.token = "";
    showLoginScreen();
  });

  document.getElementById("closeRoomModal").addEventListener("click", closeRoomEditor);
  document.getElementById("cancelRoomModal").addEventListener("click", closeRoomEditor);

  document.getElementById("roomEditorForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editRoomId").value;
    const sqFt = Number(document.getElementById("editRoomSqFt").value) || 450;
    const payload = {
      name: document.getElementById("editRoomName").value,
      category: document.getElementById("editRoomCategory").value,
      pricePerNight: Number(document.getElementById("editRoomPrice").value),
      inventory: Number(document.getElementById("editRoomInventory").value),
      maxGuests: Number(document.getElementById("editRoomGuests").value),
      sizeSqFt: sqFt,
      sizeSqM: Math.round(sqFt * 0.0929),
      bedType: document.getElementById("editRoomBed").value,
      badge: document.getElementById("editRoomBadge").value,
      view: document.getElementById("editRoomView").value,
      image: document.getElementById("editRoomImage").value,
      tagline: document.getElementById("editRoomTagline").value,
      description: document.getElementById("editRoomDesc").value,
      amenities: document
        .getElementById("editRoomAmenities")
        .value.split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    };

    try {
      if (id) {
        await apiFetch(`/api/admin/rooms/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        showToast("Room updated!");
      } else {
        await apiFetch("/api/admin/rooms", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        showToast("New room added to live website!");
      }
      closeRoomEditor();
      await loadOverview();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  if (adminState.token) {
    try {
      showAdminShell();
      await loadOverview();
    } catch {
      showLoginScreen();
    }
  } else {
    showLoginScreen();
  }
});
