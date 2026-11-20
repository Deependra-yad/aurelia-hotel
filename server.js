const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const DEFAULT_HOTEL_DATA = require("./data/hotel-data");

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || "admin123";
const PUBLIC_DIR = path.join(__dirname, "public");
const IMAGES_DIR = path.join(PUBLIC_DIR, "images");
const UPLOADS_DIR = path.join(IMAGES_DIR, "uploads");
const DATA_DIR = path.join(__dirname, "data");
const CONFIG_FILE = path.join(DATA_DIR, "hotel-config.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "bookings.json");
const INQUIRIES_FILE = path.join(DATA_DIR, "inquiries.json");

const adminSessions = new Set();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_HOTEL_DATA, null, 2), "utf8");
  }
  if (!fs.existsSync(BOOKINGS_FILE)) {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify([], null, 2), "utf8");
  }
  if (!fs.existsSync(INQUIRIES_FILE)) {
    fs.writeFileSync(INQUIRIES_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

function getHotelConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return structuredClone(DEFAULT_HOTEL_DATA);
  }
}

function saveHotelConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
}

function readJsonArray(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonArray(filePath, items) {
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf8");
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function parseJsonBody(req, maxBytes = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Payload too large (max 12MB)"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });
    req.on("error", reject);
  });
}

function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

function getNightsCount(checkInStr, checkOutStr) {
  const start = parseDateOnly(checkInStr);
  const end = parseDateOnly(checkOutStr);
  if (!start || !end) return null;
  const diffMs = end.getTime() - start.getTime();
  const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return nights > 0 && nights <= 60 ? nights : null;
}

function datesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function calculateRoomAvailability(hotelConfig, checkInStr, checkOutStr, guestsCount = 2) {
  const bookings = readJsonArray(BOOKINGS_FILE);
  const nights = getNightsCount(checkInStr, checkOutStr) || 1;
  const start = parseDateOnly(checkInStr);
  const end = parseDateOnly(checkOutStr);

  return (hotelConfig.rooms || []).map((room) => {
    let bookedUnits = 0;
    if (start && end) {
      bookedUnits = bookings.filter(
        (b) =>
          b.status === "confirmed" &&
          b.roomId === room.id &&
          datesOverlap(start, end, parseDateOnly(b.checkIn), parseDateOnly(b.checkOut))
      ).length;
    }
    const availableCount = Math.max(0, Number(room.inventory) - bookedUnits);
    const fitsGuests = Number(room.maxGuests) >= guestsCount;

    return {
      ...room,
      availableCount,
      fitsGuests,
      nights,
      estimatedSubtotal: Number(room.pricePerNight) * nights
    };
  });
}

function calculateBookingPricing({ hotelConfig, room, nights, addOnIds = [], packageId = "" }) {
  const nightlyRate = Number(room.pricePerNight);
  const baseRoomTotal = nightlyRate * nights;
  let discountAmount = 0;
  let appliedPackage = null;

  if (packageId) {
    const pkg = (hotelConfig.packages || []).find((p) => p.id === packageId);
    if (pkg && nights >= Number(pkg.minNights)) {
      appliedPackage = pkg;
      discountAmount = Math.round(baseRoomTotal * (Number(pkg.discountPercent) / 100));
    }
  }

  const discountedRoomTotal = baseRoomTotal - discountAmount;
  const selectedAddOns = [];
  let addOnsTotal = 0;

  for (const id of addOnIds) {
    const item = (hotelConfig.addOns || []).find((a) => a.id === id);
    if (item) {
      const unitPrice = Number(item.price);
      const amount = item.pricingType === "per_night" ? unitPrice * nights : unitPrice;
      addOnsTotal += amount;
      selectedAddOns.push({
        id: item.id,
        name: item.name,
        pricingType: item.pricingType,
        unitPrice,
        totalPrice: amount
      });
    }
  }

  const taxRate = Number(hotelConfig.brand?.taxRate ?? 0.12);
  const subtotal = discountedRoomTotal + addOnsTotal;
  const taxes = Math.round(subtotal * taxRate);
  const total = subtotal + taxes;

  return {
    nights,
    nightlyRate,
    baseRoomTotal,
    appliedPackage: appliedPackage
      ? { id: appliedPackage.id, title: appliedPackage.title, discountPercent: Number(appliedPackage.discountPercent) }
      : null,
    discountAmount,
    discountedRoomTotal,
    selectedAddOns,
    addOnsTotal,
    subtotal,
    taxRatePercent: Math.round(taxRate * 100),
    taxes,
    total
  };
}

function generateConfirmationCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "AUR-";
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}

function listAvailableImages() {
  const images = [];
  const scanDir = (dirPath, urlPrefix, isUploaded) => {
    if (!fs.existsSync(dirPath)) return;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) continue;
      const stat = fs.statSync(path.join(dirPath, entry.name));
      images.push({
        name: entry.name,
        url: `${urlPrefix}/${entry.name}`,
        isUploaded,
        sizeBytes: stat.size,
        updatedAt: stat.mtime.toISOString()
      });
    }
  };
  scanDir(UPLOADS_DIR, "/images/uploads", true);
  scanDir(IMAGES_DIR, "/images", false);
  return images;
}

function isAdminAuthorized(req) {
  const token = req.headers["x-admin-token"];
  return typeof token === "string" && adminSessions.has(token);
}

function slugifyId(text) {
  return String(text || "room")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || `room-${Date.now()}`;
}

function handleAdminApi(req, res, url) {
  const pathname = url.pathname;

  if (req.method === "POST" && pathname === "/api/admin/login") {
    return parseJsonBody(req)
      .then((body) => {
        if (String(body.passcode || "") !== ADMIN_PASSCODE) {
          return sendJson(res, 401, { error: "Incorrect admin passcode." });
        }
        const token = crypto.randomBytes(24).toString("hex");
        adminSessions.add(token);
        return sendJson(res, 200, { token });
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
  }

  if (!isAdminAuthorized(req)) {
    return sendJson(res, 401, { error: "Admin authentication required." });
  }

  if (req.method === "GET" && pathname === "/api/admin/overview") {
    const config = getHotelConfig();
    const bookings = readJsonArray(BOOKINGS_FILE);
    const inquiries = readJsonArray(INQUIRIES_FILE);
    const images = listAvailableImages();

    const confirmedBookings = bookings.filter((b) => b.status === "confirmed");
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (Number(b.pricing?.total) || 0), 0);
    const totalRoomsCount = (config.rooms || []).reduce((sum, r) => sum + (Number(r.inventory) || 0), 0);

    return sendJson(res, 200, {
      config,
      bookings,
      inquiries,
      images,
      stats: {
        totalRevenue,
        confirmedCount: confirmedBookings.length,
        totalBookingsCount: bookings.length,
        totalRoomsCount,
        openInquiriesCount: inquiries.filter((i) => i.status !== "resolved").length
      }
    });
  }

  if (req.method === "PUT" && pathname === "/api/admin/brand") {
    return parseJsonBody(req)
      .then((body) => {
        const config = getHotelConfig();
        config.brand = {
          ...config.brand,
          name: String(body.name ?? config.brand.name).trim(),
          shortName: String(body.shortName ?? config.brand.shortName).trim(),
          tagline: String(body.tagline ?? config.brand.tagline).trim(),
          description: String(body.description ?? config.brand.description).trim(),
          accolade: String(body.accolade ?? config.brand.accolade).trim(),
          address: String(body.address ?? config.brand.address).trim(),
          phone: String(body.phone ?? config.brand.phone).trim(),
          email: String(body.email ?? config.brand.email).trim(),
          checkInTime: String(body.checkInTime ?? config.brand.checkInTime).trim(),
          checkOutTime: String(body.checkOutTime ?? config.brand.checkOutTime).trim(),
          taxRate: Math.max(0, Math.min(0.5, Number(body.taxRate ?? config.brand.taxRate))),
          heroImage: String(body.heroImage ?? config.brand.heroImage).trim(),
          storyImage: String(body.storyImage ?? config.brand.storyImage).trim()
        };
        saveHotelConfig(config);
        return sendJson(res, 200, { brand: config.brand });
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
  }

  if (req.method === "POST" && pathname === "/api/admin/rooms") {
    return parseJsonBody(req)
      .then((body) => {
        const config = getHotelConfig();
        if (!body.name || !body.pricePerNight) {
          return sendJson(res, 400, { error: "Room name and nightly price are required." });
        }
        let id = slugifyId(body.name);
        while ((config.rooms || []).some((r) => r.id === id)) {
          id = `${id}-${crypto.randomInt(10, 99)}`;
        }
        const newRoom = {
          id,
          name: String(body.name).trim(),
          category: ["rooms", "suites", "penthouse"].includes(body.category) ? body.category : "rooms",
          badge: String(body.badge || "Signature Room").trim(),
          tagline: String(body.tagline || "Refined architectural sanctuary").trim(),
          description: String(body.description || "Thoughtfully proportioned suite with bespoke furnishings.").trim(),
          pricePerNight: Math.max(1, Number(body.pricePerNight)),
          sizeSqFt: Math.max(100, Number(body.sizeSqFt) || 450),
          sizeSqM: Math.max(10, Number(body.sizeSqM) || 42),
          maxGuests: Math.max(1, Number(body.maxGuests) || 2),
          bedType: String(body.bedType || "1 King Bed").trim(),
          view: String(body.view || "Courtyard View").trim(),
          inventory: Math.max(1, Number(body.inventory) || 4),
          image: String(body.image || "/images/room-deluxe.jpg").trim(),
          amenities: Array.isArray(body.amenities) && body.amenities.length
            ? body.amenities.map((a) => String(a).trim()).filter(Boolean)
            : ["Complimentary high-speed Wi-Fi", "Limestone rain shower", "Evening turndown service"]
        };
        config.rooms.push(newRoom);
        saveHotelConfig(config);
        return sendJson(res, 201, { room: newRoom });
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
  }

  if (req.method === "PUT" && pathname.startsWith("/api/admin/rooms/")) {
    const id = decodeURIComponent(pathname.slice("/api/admin/rooms/".length));
    return parseJsonBody(req)
      .then((body) => {
        const config = getHotelConfig();
        const idx = (config.rooms || []).findIndex((r) => r.id === id);
        if (idx === -1) return sendJson(res, 404, { error: "Room not found." });

        const current = config.rooms[idx];
        config.rooms[idx] = {
          ...current,
          name: String(body.name ?? current.name).trim(),
          category: ["rooms", "suites", "penthouse"].includes(body.category) ? body.category : current.category,
          badge: String(body.badge ?? current.badge).trim(),
          tagline: String(body.tagline ?? current.tagline).trim(),
          description: String(body.description ?? current.description).trim(),
          pricePerNight: Math.max(1, Number(body.pricePerNight ?? current.pricePerNight)),
          sizeSqFt: Math.max(50, Number(body.sizeSqFt ?? current.sizeSqFt)),
          sizeSqM: Math.max(10, Number(body.sizeSqM ?? current.sizeSqM)),
          maxGuests: Math.max(1, Number(body.maxGuests ?? current.maxGuests)),
          bedType: String(body.bedType ?? current.bedType).trim(),
          view: String(body.view ?? current.view).trim(),
          inventory: Math.max(0, Number(body.inventory ?? current.inventory)),
          image: String(body.image ?? current.image).trim(),
          amenities: Array.isArray(body.amenities)
            ? body.amenities.map((a) => String(a).trim()).filter(Boolean)
            : current.amenities
        };
        saveHotelConfig(config);
        return sendJson(res, 200, { room: config.rooms[idx] });
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/admin/rooms/")) {
    const id = decodeURIComponent(pathname.slice("/api/admin/rooms/".length));
    const config = getHotelConfig();
    if ((config.rooms || []).length <= 1) {
      return sendJson(res, 400, { error: "At least one room category must remain active." });
    }
    const nextRooms = config.rooms.filter((r) => r.id !== id);
    if (nextRooms.length === config.rooms.length) {
      return sendJson(res, 404, { error: "Room not found." });
    }
    config.rooms = nextRooms;
    saveHotelConfig(config);
    return sendJson(res, 200, { deletedId: id });
  }

  if (req.method === "PUT" && pathname === "/api/admin/pricing-rules") {
    return parseJsonBody(req)
      .then((body) => {
        const config = getHotelConfig();
        if (Array.isArray(body.addOns)) {
          config.addOns = body.addOns.map((a) => ({
            id: a.id || slugifyId(a.name),
            name: String(a.name).trim(),
            description: String(a.description || "").trim(),
            price: Math.max(0, Number(a.price) || 0),
            pricingType: a.pricingType === "per_night" ? "per_night" : "per_stay"
          }));
        }
        if (Array.isArray(body.packages)) {
          config.packages = body.packages.map((p) => ({
            id: p.id || slugifyId(p.title),
            badge: String(p.badge || "Offer").trim(),
            title: String(p.title).trim(),
            description: String(p.description || "").trim(),
            discountPercent: Math.max(0, Math.min(80, Number(p.discountPercent) || 0)),
            minNights: Math.max(1, Number(p.minNights) || 1),
            includedPerk: String(p.includedPerk || "").trim()
          }));
        }
        saveHotelConfig(config);
        return sendJson(res, 200, { addOns: config.addOns, packages: config.packages });
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
  }

  if (req.method === "PUT" && pathname.startsWith("/api/admin/services/")) {
    const id = decodeURIComponent(pathname.slice("/api/admin/services/".length));
    return parseJsonBody(req)
      .then((body) => {
        const config = getHotelConfig();
        const idx = (config.services || []).findIndex((s) => s.id === id);
        if (idx === -1) return sendJson(res, 404, { error: "Service not found." });
        const cur = config.services[idx];
        config.services[idx] = {
          ...cur,
          title: String(body.title ?? cur.title).trim(),
          subtitle: String(body.subtitle ?? cur.subtitle).trim(),
          description: String(body.description ?? cur.description).trim(),
          hours: String(body.hours ?? cur.hours).trim(),
          image: String(body.image ?? cur.image).trim()
        };
        saveHotelConfig(config);
        return sendJson(res, 200, { service: config.services[idx] });
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
  }

  if (req.method === "POST" && pathname === "/api/admin/upload") {
    return parseJsonBody(req)
      .then((body) => {
        const { filename = "hotel-photo.jpg", dataUrl = "" } = body;
        const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
        if (!match) {
          return sendJson(res, 400, { error: "Invalid image format. Please upload PNG, JPG, or WEBP." });
        }
        const ext = match[1] === "jpeg" ? "jpg" : match[1];
        const baseName = slugifyId(path.basename(filename, path.extname(filename)));
        const safeFileName = `${baseName}-${Date.now()}.${ext}`;
        const destPath = path.join(UPLOADS_DIR, safeFileName);
        const buffer = Buffer.from(match[2], "base64");
        fs.writeFileSync(destPath, buffer);
        return sendJson(res, 201, {
          url: `/images/uploads/${safeFileName}`,
          name: safeFileName,
          sizeBytes: buffer.length
        });
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/admin/images/")) {
    const name = path.basename(decodeURIComponent(pathname.slice("/api/admin/images/".length)));
    const target = path.join(UPLOADS_DIR, name);
    if (!target.startsWith(UPLOADS_DIR) || !fs.existsSync(target)) {
      return sendJson(res, 404, { error: "Uploaded image not found." });
    }
    fs.unlinkSync(target);
    return sendJson(res, 200, { deleted: name });
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/admin/bookings/")) {
    const code = decodeURIComponent(pathname.slice("/api/admin/bookings/".length)).trim().toUpperCase();
    return parseJsonBody(req)
      .then((body) => {
        const bookings = readJsonArray(BOOKINGS_FILE);
        const idx = bookings.findIndex((b) => b.confirmationCode === code);
        if (idx === -1) return sendJson(res, 404, { error: "Reservation not found." });
        if (body.status === "confirmed" || body.status === "cancelled") {
          bookings[idx].status = body.status;
        }
        writeJsonArray(BOOKINGS_FILE, bookings);
        return sendJson(res, 200, { booking: bookings[idx] });
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/admin/inquiries/")) {
    const id = decodeURIComponent(pathname.slice("/api/admin/inquiries/".length));
    return parseJsonBody(req)
      .then((body) => {
        const inquiries = readJsonArray(INQUIRIES_FILE);
        const idx = inquiries.findIndex((i) => i.id === id);
        if (idx === -1) return sendJson(res, 404, { error: "Inquiry not found." });
        inquiries[idx].status = body.status === "resolved" ? "resolved" : "open";
        writeJsonArray(INQUIRIES_FILE, inquiries);
        return sendJson(res, 200, { inquiry: inquiries[idx] });
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
  }

  return sendJson(res, 404, { error: "Admin API route not found." });
}

function handleApiRequest(req, res, url) {
  const pathname = url.pathname;

  if (pathname.startsWith("/api/admin/")) {
    return handleAdminApi(req, res, url);
  }

  const hotelConfig = getHotelConfig();

  if (req.method === "GET" && pathname === "/api/hotel") {
    return sendJson(res, 200, hotelConfig);
  }

  if (req.method === "GET" && pathname === "/api/availability") {
    const checkIn = url.searchParams.get("checkIn") || "";
    const checkOut = url.searchParams.get("checkOut") || "";
    const guests = Math.max(1, Number(url.searchParams.get("guests")) || 2);
    const rooms = calculateRoomAvailability(hotelConfig, checkIn, checkOut, guests);
    return sendJson(res, 200, {
      checkIn,
      checkOut,
      guests,
      nights: getNightsCount(checkIn, checkOut) || 1,
      rooms
    });
  }

  if (req.method === "POST" && pathname === "/api/bookings") {
    return parseJsonBody(req)
      .then((body) => {
        const {
          roomId,
          checkIn,
          checkOut,
          adults = 2,
          children = 0,
          addOnIds = [],
          packageId = "",
          guest = {},
          specialRequests = "",
          paymentPreference = "pay_at_hotel"
        } = body;

        const nights = getNightsCount(checkIn, checkOut);
        if (!nights) {
          return sendJson(res, 400, { error: "Please select valid check-in and check-out dates (1–60 nights)." });
        }

        const room = (hotelConfig.rooms || []).find((r) => r.id === roomId);
        if (!room) {
          return sendJson(res, 404, { error: "Selected room category was not found." });
        }

        const totalGuests = Number(adults) + Number(children);
        if (totalGuests < 1 || totalGuests > Number(room.maxGuests)) {
          return sendJson(res, 400, {
            error: `${room.name} accommodates up to ${room.maxGuests} guests.`
          });
        }

        if (!guest.fullName || !guest.email || !guest.phone) {
          return sendJson(res, 400, { error: "Guest full name, email, and phone number are required." });
        }

        const availability = calculateRoomAvailability(hotelConfig, checkIn, checkOut, totalGuests);
        const targetRoom = availability.find((r) => r.id === roomId);
        if (!targetRoom || targetRoom.availableCount < 1) {
          return sendJson(res, 409, {
            error: `Sorry, ${room.name} is sold out for ${checkIn} to ${checkOut}. Please select another suite or date range.`
          });
        }

        const pricing = calculateBookingPricing({
          hotelConfig,
          room,
          nights,
          addOnIds: Array.isArray(addOnIds) ? addOnIds : [],
          packageId
        });

        const bookings = readJsonArray(BOOKINGS_FILE);
        let confirmationCode = generateConfirmationCode();
        while (bookings.some((b) => b.confirmationCode === confirmationCode)) {
          confirmationCode = generateConfirmationCode();
        }

        const newBooking = {
          confirmationCode,
          status: "confirmed",
          createdAt: new Date().toISOString(),
          roomId: room.id,
          roomName: room.name,
          roomImage: room.image,
          checkIn,
          checkOut,
          nights,
          adults: Number(adults),
          children: Number(children),
          guest: {
            fullName: String(guest.fullName).trim(),
            email: String(guest.email).trim(),
            phone: String(guest.phone).trim(),
            arrivalTime: String(guest.arrivalTime || "3:00 PM").trim()
          },
          specialRequests: String(specialRequests || "").trim(),
          paymentPreference,
          pricing
        };

        bookings.unshift(newBooking);
        writeJsonArray(BOOKINGS_FILE, bookings);

        return sendJson(res, 201, { booking: newBooking });
      })
      .catch((err) => sendJson(res, 400, { error: err.message || "Invalid booking request." }));
  }

  if (req.method === "GET" && pathname.startsWith("/api/bookings/")) {
    const code = decodeURIComponent(pathname.replace("/api/bookings/", "").replace("/cancel", "")).trim().toUpperCase();
    const bookings = readJsonArray(BOOKINGS_FILE);
    const booking = bookings.find((b) => b.confirmationCode === code);
    if (!booking) {
      return sendJson(res, 404, { error: `No reservation found with confirmation code ${code}.` });
    }
    return sendJson(res, 200, { booking });
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/bookings/") && pathname.endsWith("/cancel")) {
    const code = decodeURIComponent(
      pathname.slice("/api/bookings/".length, pathname.length - "/cancel".length)
    )
      .trim()
      .toUpperCase();
    const bookings = readJsonArray(BOOKINGS_FILE);
    const idx = bookings.findIndex((b) => b.confirmationCode === code);
    if (idx === -1) {
      return sendJson(res, 404, { error: `No reservation found with confirmation code ${code}.` });
    }
    bookings[idx].status = "cancelled";
    bookings[idx].cancelledAt = new Date().toISOString();
    writeJsonArray(BOOKINGS_FILE, bookings);
    return sendJson(res, 200, { booking: bookings[idx] });
  }

  if (req.method === "POST" && pathname === "/api/inquiries") {
    return parseJsonBody(req)
      .then((body) => {
        const { name, email, topic = "Concierge Inquiry", message } = body;
        if (!name || !email || !message) {
          return sendJson(res, 400, { error: "Name, email, and message are required." });
        }
        const inquiries = readJsonArray(INQUIRIES_FILE);
        const entry = {
          id: `INQ-${crypto.randomInt(10000, 99999)}`,
          status: "open",
          createdAt: new Date().toISOString(),
          name: String(name).trim(),
          email: String(email).trim(),
          topic: String(topic).trim(),
          message: String(message).trim()
        };
        inquiries.unshift(entry);
        writeJsonArray(INQUIRIES_FILE, inquiries);
        return sendJson(res, 201, { inquiry: entry });
      })
      .catch((err) => sendJson(res, 400, { error: err.message || "Invalid inquiry payload." }));
  }

  return sendJson(res, 404, { error: "API route not found." });
}

function serveStaticFile(req, res, url) {
  let reqPath = decodeURIComponent(url.pathname);
  if (reqPath === "/admin" || reqPath === "/admin/" || reqPath === "/admin.html") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }
  if (reqPath === "/") {
    reqPath = "/index.html";
  } else if (reqPath === "/secreat" || reqPath === "/secreat/") {
    reqPath = "/admin.html";
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallback = path.join(PUBLIC_DIR, "index.html");
      if (fs.existsSync(fallback)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        fs.createReadStream(fallback).pipe(res);
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    fs.createReadStream(filePath).pipe(res);
  });
}

ensureDataFiles();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    handleApiRequest(req, res, url);
    return;
  }
  serveStaticFile(req, res, url);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Aurelia Grand Hotel server running at http://localhost:${PORT}`);
});
