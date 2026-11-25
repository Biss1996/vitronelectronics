import { sql, json } from "./db.js";
import { fields, normalizePhone } from "./validate.js";
import { badRequest } from "./http.js";

// Store settings live in one JSONB row (key = 'store'), merged over these defaults.
export const DEFAULT_SETTINGS = {
  storeName: "Vitron Electronics",
  tagline: "Smart life. Genuine electronics delivered to your door — pay when it arrives.",
  whatsappNumber: "254700000000",   // digits only, international format, used for wa.me links
  contactPhone: "+254700000000",
  contactEmail: "hello@vitron.co.ke",
  address: "KTDA Farmers Building, 1st Floor, Room 106, Moi Avenue, Nairobi",
  // What the map pin points to: a place name, "lat,lng", or a Google Maps link containing @lat,lng
  mapLocation: "KTDA Farmers Building, Moi Avenue, Nairobi",
  businessHours: "Mon–Sat, 8am – 7pm",
  announcement: "Genuine electronics · Pay on delivery",
  deliveryFeesEnabled: false,        // frozen: delivery is free on every order; fee fields hidden in admin
  deliveryZones: [
    { id: "nairobi", name: "Nairobi & environs", fee: 200, eta: "Same day / next day" },
    { id: "outside", name: "Outside Nairobi (courier)", fee: 500, eta: "1–3 days" },
  ],
  freeDeliveryOver: 30000,           // 0 = never free
  socials: { facebook: "", instagram: "", tiktok: "", x: "" },
};

let cache = null;
let cacheAt = 0;

export async function getSettings() {
  if (cache && Date.now() - cacheAt < 30_000) return cache;
  const [row] = await sql`SELECT value FROM settings WHERE key = 'store'`;
  cache = { ...DEFAULT_SETTINGS, ...(row?.value || {}) };
  cache.socials = { ...DEFAULT_SETTINGS.socials, ...(cache.socials || {}) };
  cacheAt = Date.now();
  return cache;
}

export function deliveryFee(settings, zoneId, subtotal) {
  const zone = settings.deliveryZones.find((z) => z.id === zoneId);
  if (!zone) return null;
  if (!settings.deliveryFeesEnabled) return { zone, fee: 0, pending: false }; // frozen → free delivery
  const free = settings.freeDeliveryOver > 0 && subtotal >= settings.freeDeliveryOver;
  return { zone, fee: free ? 0 : zone.fee, pending: false };
}

export async function updateSettings(body) {
  const current = await getSettings();
  const v = fields(body);
  const next = { ...current };

  if (v.has("storeName")) next.storeName = v.str("storeName", { label: "Store name", max: 60 });
  if (v.has("tagline")) next.tagline = v.str("tagline", { label: "Tagline", required: false, max: 140 }) || "";
  if (v.has("announcement")) next.announcement = v.str("announcement", { required: false, max: 200 }) || "";
  if (v.has("address")) next.address = v.str("address", { required: false, max: 200 }) || "";
  if (v.has("mapLocation")) next.mapLocation = v.str("mapLocation", { label: "Map pin", required: false, max: 500 }) || "";
  if (v.has("businessHours")) next.businessHours = v.str("businessHours", { required: false, max: 100 }) || "";
  if (v.has("contactEmail")) next.contactEmail = v.email("contactEmail", { label: "Contact email" }) || "";
  if (v.has("contactPhone")) {
    const p = v.phone("contactPhone", { label: "Contact phone" });
    if (p) next.contactPhone = p;
  }
  if (v.has("whatsappNumber")) {
    const p = normalizePhone(body.whatsappNumber);
    if (!p) v.fail("whatsappNumber", "WhatsApp number must be a valid Kenyan number");
    else next.whatsappNumber = p.slice(1); // wa.me wants digits only
  }
  if (body.deliveryFeesEnabled !== undefined) next.deliveryFeesEnabled = body.deliveryFeesEnabled === true;
  if (v.has("freeDeliveryOver")) next.freeDeliveryOver = v.int("freeDeliveryOver", { label: "Free delivery threshold", max: 10_000_000 });

  if (body.deliveryZones !== undefined) {
    if (!Array.isArray(body.deliveryZones) || body.deliveryZones.length === 0 || body.deliveryZones.length > 30) {
      throw badRequest("Add at least one delivery zone");
    }
    const ids = new Set();
    next.deliveryZones = body.deliveryZones.map((z, i) => {
      const name = String(z?.name || "").trim();
      const fee = Number(z?.fee);
      if (!name) throw badRequest(`Delivery zone ${i + 1} needs a name`);
      if (!Number.isInteger(fee) || fee < 0) throw badRequest(`Delivery fee for "${name}" must be a whole number`);
      let id = String(z?.id || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `zone-${i}`;
      while (ids.has(id)) id += "-x";
      ids.add(id);
      return { id, name: name.slice(0, 80), fee, eta: String(z?.eta || "").slice(0, 60) };
    });
  }

  if (body.socials && typeof body.socials === "object") {
    next.socials = { ...current.socials };
    for (const k of Object.keys(DEFAULT_SETTINGS.socials)) {
      if (body.socials[k] !== undefined) {
        const url = String(body.socials[k] || "").trim();
        if (url && !/^https?:\/\//.test(url)) v.fail(`socials.${k}`, `${k} link must start with https://`);
        next.socials[k] = url.slice(0, 300);
      }
    }
  }

  v.done();
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES ('store', ${json(next)}::text::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  cache = null;
  return getSettings();
}
