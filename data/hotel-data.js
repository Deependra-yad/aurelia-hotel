const HOTEL_DATA = {
  brand: {
    name: "Aurelia Grand Hotel & Spa",
    shortName: "Aurelia",
    tagline: "Where Quiet Architecture Meets Timeless Hospitality",
    description:
      "An intimate 48-suite urban sanctuary blending warm travertine architecture, bespoke butler service, thermal wellness, and Michelin-caliber seasonal dining.",
    rating: "5.0",
    reviewCount: 642,
    accolade: "Two Michelin Keys · 2026 Preferred Sanctuary",
    address: "148 Promenade des Arts, Heritage Quarter",
    city: "Geneva · Zurich · Lakefront District",
    phone: "+1 (800) 555-0194",
    email: "concierge@aureliagrand.com",
    checkInTime: "3:00 PM",
    checkOutTime: "12:00 PM",
    currency: "USD",
    taxRate: 0.12,
    heroImage: "/images/hero-hotel.jpg",
    storyImage: "/images/room-suite.jpg"
  },
  rooms: [
    {
      id: "courtyard-atelier",
      name: "Courtyard Atelier King",
      category: "rooms",
      badge: "Signature Room",
      tagline: "Quiet garden courtyard views with bespoke walnut millwork",
      description:
        "Designed for restorative stays, the Courtyard Atelier King features acoustic triple-glazed French doors, Italian 600-thread-count percale linens, and a sculpted limestone rain shower.",
      pricePerNight: 340,
      sizeSqFt: 420,
      sizeSqM: 39,
      maxGuests: 2,
      bedType: "1 California King Bed",
      view: "Olive Courtyard",
      inventory: 8,
      image: "/images/room-courtyard.jpg",
      amenities: [
        "Acoustic courtyard French balcony",
        "Walk-in limestone rain shower",
        "Nespresso Vertuo & artisanal tea bar",
        "Automated circadian lighting & blackout drapes",
        "Bang & Olufsen spatial audio speaker",
        "Heated marble bathroom floors"
      ]
    },
    {
      id: "deluxe-terrace",
      name: "Deluxe Terrace King",
      category: "rooms",
      badge: "Guest Favorite",
      tagline: "Sunlit private stone balcony overlooking botanical gardens",
      description:
        "Expansive proportions and a furnished private terrace make this room ideal for longer escapes. Includes a custom writing alcove, soaking tub, and curated mini-cellar.",
      pricePerNight: 460,
      sizeSqFt: 540,
      sizeSqM: 50,
      maxGuests: 3,
      bedType: "1 King Bed + Daybed Lounge",
      view: "Botanical Terrace",
      inventory: 6,
      image: "/images/room-deluxe.jpg",
      amenities: [
        "Private furnished stone terrace",
        "Deep freestanding travertine soaking tub",
        "Dedicated concierge tablet & 24h room dining",
        "Complimentary garment pressing (2 items/day)",
        "Italian cashmere throws & pillow menu",
        "High-speed 1 Gbps private Wi-Fi VLAN"
      ]
    },
    {
      id: "executive-garden-suite",
      name: "Executive Garden Suite",
      category: "suites",
      badge: "Most Booked Suite",
      tagline: "Separate living salon, travertine fireplace & private veranda",
      description:
        "An architectural residence with a dedicated entertaining salon, wood-burning travertine hearth, dining table for four, and priority access to the Thermal Sanctuary.",
      pricePerNight: 720,
      sizeSqFt: 860,
      sizeSqM: 80,
      maxGuests: 4,
      bedType: "1 King Bed + Separate Living Salon",
      view: "Cypress Gardens & Reflecting Pool",
      inventory: 4,
      image: "/images/room-suite.jpg",
      amenities: [
        "Separate living salon with travertine fireplace",
        "Complimentary round-trip chauffeur airport transfer",
        "Daily champagne aperitif service at 6:00 PM",
        "Dedicated personal butler on WhatsApp & intercom",
        "Double marble vanity & steam shower",
        "Complimentary breakfast for two daily"
      ]
    },
    {
      id: "aurelia-penthouse",
      name: "The Aurelia Panoramic Penthouse",
      category: "penthouse",
      badge: "Flagship Residence",
      tagline: "Top-floor 270° skyline & water views with private dining terrace",
      description:
        "Occupying the entire south crown of the hotel, our flagship Penthouse pairs museum-grade contemporary art, a private wellness sauna, full chef pantry, and 24-hour dedicated butler.",
      pricePerNight: 1450,
      sizeSqFt: 1680,
      sizeSqM: 156,
      maxGuests: 4,
      bedType: "1 Master King + Optional Connecting Suite",
      view: "270° Skyline & Sunset Horizon",
      inventory: 2,
      image: "/images/room-penthouse.jpg",
      amenities: [
        "Wrap-around panoramic sunset terrace",
        "Private Finnish cedar sauna & soaking tub",
        "In-suite private chef tasting available",
        "Private arrival elevator & Maybach airport transfer",
        "Bespoke wine cellar curated by Head Sommelier",
        "Unlimited access to all thermal spa rituals"
      ]
    }
  ],
  services: [
    {
      id: "thermal-spa",
      category: "Wellness & Spa",
      title: "The Aurelia Thermal Sanctuary",
      subtitle: "14,000 sq ft subterranean limestone baths & holistic treatments",
      description:
        "Descend into candlelit travertine vaults featuring a 25-meter heated mineral infinity pool, Himalayan salt steam room, Nordic cold plunge, and bespoke botanical facials.",
      hours: "Daily · 6:30 AM – 10:00 PM",
      image: "/images/service-spa.jpg",
      highlights: [
        "Heated indoor-outdoor mineral pool",
        "6 private couples treatment suites",
        "Private Pilates & Technogym studio",
        "Guided breathwork & sound healing"
      ]
    },
    {
      id: "fine-dining",
      category: "Culinary & Cellar",
      title: "Atelier Lumiére & The Velvet Bar",
      subtitle: "Seasonal hearth-fired tasting menus & 900-label wine cellar",
      description:
        "Helmed by Chef Julian Vance, Atelier Lumiére celebrates hyper-local biodynamic harvests over open oak embers, paired with rare vintages and botanical nightcaps.",
      hours: "Breakfast 7 AM · Dinner 6 PM – 11 PM",
      image: "/images/service-dining.jpg",
      highlights: [
        "7-course Chef's Hearth Tasting Menu",
        "Private 12-seat Glass Cellar dining room",
        "All-day courtyard terrace & afternoon tea",
        "24-hour bespoke in-suite dining"
      ]
    }
  ],
  additionalServices: [
    {
      icon: "concierge",
      title: "24/7 Clefs d'Or Concierge",
      description: "Private gallery viewings, last-minute theatre boxes, yacht charters, and tailored city itineraries."
    },
    {
      icon: "chauffeur",
      title: "House Chauffeur & EV Valet",
      description: "Fleet of electric Mercedes EQS sedans for seamless airport arrivals and complimentary 3-mile town drops."
    },
    {
      icon: "events",
      title: "Private Salons & Weddings",
      description: "Sunlit limestone conservatory and courtyard lawn hosting executive retreats and intimate galas up to 120 guests."
    },
    {
      icon: "family",
      title: "Family & Pet Privileges",
      description: "Complimentary cribs, organic welcome treats, curated children's amenities, and dedicated pet-sitting."
    },
    {
      icon: "business",
      title: "Executive Boardrooms",
      description: "Soundproof oak boardrooms with 4K telepresence, espresso service, and dedicated event technician."
    },
    {
      icon: "included",
      title: "Included With Every Stay",
      description: "Welcome herbal elixir, evening turndown, garment steaming, digital press, and morning yoga."
    }
  ],
  addOns: [
    {
      id: "breakfast",
      name: "Artisanal Daily Breakfast for Two",
      description: "À la carte courtyard or in-suite breakfast with pastries, cold-pressed juices & barista coffee.",
      price: 65,
      pricingType: "per_night"
    },
    {
      id: "chauffeur",
      name: "Private Chauffeur Airport Transfer",
      description: "Meet-and-greet arrival & departure in our Mercedes-Benz EQS electric limousine.",
      price: 140,
      pricingType: "per_stay"
    },
    {
      id: "spa-ritual",
      name: "Couples Thermal Spa & 90-Min Massage",
      description: "Private suite mineral bath, warm basalt stone massage, and herbal elixir service.",
      price: 320,
      pricingType: "per_stay"
    },
    {
      id: "tasting-dinner",
      name: "Atelier Lumiére Tasting Dinner for Two",
      description: "Reserved prime table for our 7-course seasonal hearth tasting menu.",
      price: 260,
      pricingType: "per_stay"
    },
    {
      id: "late-checkout",
      name: "Guaranteed Late Checkout (4:00 PM)",
      description: "Unhurried final afternoon in your room with full spa access until departure.",
      price: 95,
      pricingType: "per_stay"
    }
  ],
  packages: [
    {
      id: "sanctuary-escape",
      badge: "Best Value · Save 15%",
      title: "The Weekend Sanctuary",
      description: "3+ nights with 15% savings on room rate, daily artisanal breakfast, and thermal spa access.",
      discountPercent: 15,
      minNights: 3,
      includedPerk: "15% Room Savings + Complimentary Thermal Access"
    },
    {
      id: "romantic-retreat",
      badge: "Couples Favorite",
      title: "Romance & Candlelight",
      description: "Chilled vintage champagne on arrival, rose petal turndown, couples spa privilege & 2 PM checkout.",
      discountPercent: 8,
      minNights: 2,
      includedPerk: "8% Savings + Champagne & 2 PM Late Checkout"
    },
    {
      id: "executive-stay",
      badge: "Business Ready",
      title: "Executive Atelier Stay",
      description: "Priority early check-in, daily garment pressing, boardroom credit & express breakfast.",
      discountPercent: 10,
      minNights: 1,
      includedPerk: "10% Corporate Rate + Pressing & Early Check-in"
    }
  ],
  testimonials: [
    {
      quote:
        "The quietest, most thoughtfully proportioned hotel I have stayed in across Europe. The subterranean pool at dusk feels like stepping into another century.",
      author: "Elena Rostova",
      role: "Architectural Critic · Milan",
      stay: "Executive Garden Suite"
    },
    {
      quote:
        "Every touchpoint felt effortless—from the electric limousine awaiting us at arrival to our butler remembering how we take our morning espresso.",
      author: "Marcus & Claire Vance",
      role: "Anniversary Stay · New York",
      stay: "The Aurelia Penthouse"
    },
    {
      quote:
        "Atelier Lumiére alone merits a special journey. Combine it with the courtyard rooms and you have a benchmark for modern grand hotels.",
      author: "Dr. Kenji Takahashi",
      role: "Design Collector · Tokyo",
      stay: "Deluxe Terrace King"
    }
  ],
  faqs: [
    {
      q: "What is your cancellation and modification policy?",
      a: "Standard reservations may be modified or cancelled free of charge up to 48 hours prior to 3:00 PM local time on your arrival date. You can manage or cancel your reservation anytime directly on this website using your confirmation code."
    },
    {
      q: "Is breakfast or spa access included in the room rate?",
      a: "All guests enjoy complimentary access to our fitness pavilion, morning yoga, evening turndown, and high-speed Wi-Fi. Thermal Sanctuary bath access and daily breakfast are included in Suite categories and can be added to any Atelier or Deluxe room during booking."
    },
    {
      q: "Do you offer airport transfers and valet parking?",
      a: "Yes. We provide private electric Mercedes-Benz EQS chauffeur transfers (25 minutes from the international airport) as well as 24-hour covered valet parking with dedicated high-speed EV chargers."
    },
    {
      q: "Can you accommodate early check-in or late checkout?",
      a: "Standard check-in is 3:00 PM and checkout is 12:00 PM. Early check-in is prioritized based on availability, and guaranteed 4:00 PM late checkout can be reserved during booking."
    }
  ]
};

module.exports = HOTEL_DATA;
