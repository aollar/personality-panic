/*
 * PERSONALITY PANIC — painted-menu hotspot map.
 * Each scene's action menu is PAINTED INTO the art; these boxes clip the
 * painted buttons so they're clickable. Coordinates are percent of the full
 * 1672x941 scene image: [x, y, w, h] = top-left + size.
 * a = Action_ID from the Balance Lock sheet (X-ids = assumptions.js extras).
 * Mapped by hand from grid-annotated crops of every scene.
 */
var PP_HOTSPOTS = {
  lowCost: [
    { a: "X006", box: [84.0, 7.5, 14.5, 5.0] },   // PAY RENT tab
    { a: "A001", box: [70.5, 13.0, 13.5, 24.0] }, // Bunk Bed Deluxe
    { a: "A002", box: [84.0, 13.0, 14.5, 24.0] }, // Relaxation Zone
    { a: "A003", box: [70.5, 38.0, 13.5, 20.0] }, // Open-Concept Bathroom
    { a: "A004", box: [84.0, 38.0, 14.5, 20.0] }, // Former Yard Fitness
    { a: "A005", box: [70.5, 59.0, 13.5, 20.0] }, // Decorate Your Cell
    { a: "A006", box: [84.0, 59.0, 14.5, 20.0] }, // Hang With Pet
    { a: "A007", box: [70.5, 80.0, 13.5, 9.0] },  // Feed Pet
    { a: "A001", box: [70.5, 89.5, 28.0, 9.5] }   // featured: Bunk Bed
  ],
  luxury: [
    { a: "X007", box: [87.0, 10.0, 11.3, 4.8] },   // PAY RENT tab
    { a: "A009", box: [76.5, 16.0, 10.0, 17.0] }, // Sleep in Fancy Bed
    { a: "A010", box: [87.0, 16.0, 11.0, 17.0] }, // Luxury Bath
    { a: "A011", box: [76.5, 34.0, 10.0, 16.0] }, // Relax in Your Suite
    { a: "A012", box: [87.0, 34.0, 11.0, 16.0] }, // Condo Gym
    { a: "A013", box: [76.5, 50.5, 10.0, 15.0] }, // Order Fancy Food
    { a: "A014", box: [87.0, 50.5, 11.0, 15.0] }, // Host Friends
    { a: "A015", box: [76.5, 66.0, 10.0, 12.0] }, // Work From Home
    { a: "A016", box: [87.0, 66.0, 11.0, 12.0] }, // Pet Spa Treatment
    { a: "A009", box: [76.5, 79.0, 21.5, 17.0] }  // featured: Fancy Bed
  ],
  park: [
    { a: "A018", box: [72.2, 12.2, 11.5, 19.7] },
    { a: "A019", box: [85.4, 12.2, 13.0, 19.7] },
    { a: "A020", box: [72.2, 34.2, 11.5, 19.1] },
    { a: "A021", box: [85.4, 34.2, 13.0, 19.1] },
    { a: "A022", box: [72.2, 55.0, 11.5, 19.4] },
    { a: "A023", box: [85.4, 55.0, 13.0, 19.4] },
    { a: "A019", box: [72.2, 76.3, 26.2, 15.3] },
    { a: "A024", box: [72.2, 92.5, 26.2, 6.9] }
  ],
  airOne: [
    { a: "A026", box: [70.6, 11.5, 12.9, 24.8] },
    { a: "A027", box: [83.9, 11.5, 14.9, 24.8] },
    { a: "A028", box: [70.6, 38.6, 12.9, 24.1] },
    { a: "A029", box: [83.9, 38.6, 14.9, 24.1] },
    { a: "A030", box: [70.6, 64.0, 28.2, 10.6] },
    { a: "A033", work: true, box: [77.2, 84.0, 21.6, 11.8] }
  ],
  regretBurger: [
    { a: "A034", box: [67.5, 12.2, 10.2, 25.5] },
    { a: "A035", box: [78.2, 12.2, 10.2, 25.5] },
    { a: "A036", box: [89.1, 12.2, 9.7, 25.5] },
    { a: "A037", box: [67.9, 39.5, 14.8, 23.0] },
    { a: "A038", box: [83.3, 39.5, 15.4, 23.0] },
    { a: "A035", box: [67.9, 64.6, 30.8, 16.7] },
    { a: "A041", work: true, box: [71.0, 85.0, 25.0, 12.0] }
  ],
  gym: [
    { a: "A042", box: [74.3, 11.5, 11.0, 19.5] },
    { a: "A043", box: [86.0, 11.5, 11.7, 19.5] },
    { a: "A044", box: [74.3, 32.2, 11.0, 19.6] },
    { a: "A045", box: [86.0, 32.2, 11.7, 19.6] },
    { a: "A046", box: [74.3, 52.9, 11.0, 14.9] },
    { a: "A047", box: [86.0, 52.9, 11.7, 14.9] },
    { a: "A042", box: [74.3, 69.1, 23.4, 10.1] },
    { a: "A049", work: true, box: [79.7, 88.0, 18.3, 10.0] }
  ],
  temple: [
    { a: "A058", box: [72.0, 11.0, 9.4, 26.0] },
    { a: "A059", box: [81.9, 11.0, 8.5, 26.0] },
    { a: "A060", box: [90.8, 11.0, 7.7, 26.0] },
    { a: "A061", box: [72.1, 39.0, 12.5, 21.0] },
    { a: "A062", box: [85.4, 39.0, 13.0, 21.0] },
    { a: "A063", box: [72.1, 61.1, 26.3, 20.2] },
    { a: "A066", work: true, box: [80.3, 83.5, 18.5, 12.0] }
  ],
  university: [
    { a: "A067", box: [74.3, 11.9, 12.4, 23.2] },
    { a: "A068", box: [87.3, 11.9, 10.9, 23.2] },
    { a: "A069", box: [74.3, 37.0, 12.4, 23.4] },
    { a: "A070", box: [87.3, 37.0, 10.9, 23.4] },
    { a: "A071", box: [74.3, 62.2, 12.4, 21.2] },
    { a: "A072", box: [87.3, 62.2, 10.9, 21.2] },
    { a: "A075", work: true, box: [82.8, 87.8, 15.9, 9.0] }
  ],
  soulExchange: [
    { a: "A076", box: [73.4, 9.4, 11.0, 17.2] },
    { a: "A078", box: [85.2, 9.4, 13.2, 17.2] },
    { a: "A079", box: [73.4, 27.8, 11.0, 17.4] },
    { a: "A080", box: [85.2, 27.8, 13.2, 17.4] },
    { a: "A081", box: [73.4, 45.9, 11.0, 12.9] },
    { a: "A082", box: [85.2, 45.9, 13.2, 12.9] },
    { a: "A083", box: [73.4, 60.0, 25.0, 14.0] },
    { a: "A076", box: [73.4, 73.0, 25.0, 17.5] },
    { a: "A077", work: true, box: [83.0, 90.3, 15.7, 9.2] }
  ],
  debtstreet: [
    { a: "A085", box: [68.5, 16.0, 13.0, 14.0] },
    { a: "A086", box: [82.0, 16.0, 16.0, 14.0] },
    { a: "A087", box: [68.5, 31.0, 13.0, 15.0] },
    { a: "A088", box: [82.0, 31.0, 16.0, 15.0] },
    { a: "A089", box: [68.5, 47.0, 13.0, 15.0] },
    { a: "A090", box: [82.0, 47.0, 16.0, 15.0] },
    { a: "A091", box: [68.5, 63.0, 29.5, 11.0] },
    { a: "A092", work: true, box: [83.0, 83.0, 15.0, 13.5] }
  ],
  airport: [
    { a: "A093", box: [73.9, 10.6, 11.5, 24.5] },
    { a: "A094", box: [85.8, 10.6, 12.9, 24.5] },
    { a: "A095", box: [73.9, 37.0, 11.5, 22.5] },
    { a: "A096", box: [85.8, 37.0, 12.9, 22.5] },
    { a: "A097", box: [73.9, 60.1, 11.5, 21.7] },
    { a: "A098", box: [85.8, 60.1, 12.9, 21.7] },
    { a: "A101", work: true, box: [82.4, 85.0, 16.3, 12.8] }
  ],
  petShop: [
    { a: "A102", box: [79.5, 5.5, 6.5, 4.0] },    // ADOPT tab
    { a: "A108", box: [92.5, 5.5, 6.0, 4.0] },    // BRIBES tab -> Bribe Inspector
    { a: "A103", box: [80.0, 12.0, 9.0, 25.0] },  // Buy Pet Food
    { a: "A104", box: [89.0, 12.0, 9.5, 25.0] },  // Buy Pet Toy
    { a: "A105", box: [80.0, 38.0, 9.0, 23.0] },  // Feed Animals
    { a: "A106", box: [89.0, 38.0, 9.5, 23.0] },  // Bathe Animals
    { a: "A107", box: [80.0, 62.0, 18.5, 21.0] }, // Play With Pet
    { a: "A110", box: [86.5, 89.0, 12.5, 10.0], work: true } // WORK
  ],
  mall: [
    { a: "A115", box: [70.0, 9.0, 11.0, 5.0] },   // STYLE tab -> Clothing
    { a: "A113", box: [81.0, 9.0, 9.0, 5.0] },    // GEAR tab -> Electronics/Appliances
    { a: "A114", box: [90.0, 9.0, 8.5, 5.0] },    // HOME tab -> Furniture
    { a: "A115", box: [70.0, 15.0, 28.5, 42.0] }, // item grid -> Clothing shop
    { a: "A115", box: [70.0, 63.0, 28.5, 16.0] }, // featured item -> Clothing shop
    { a: "A118", box: [71.0, 88.5, 27.0, 10.5], work: true } // WORK
  ]
  // club: handled separately (video + animated side menu iframe)
};
// Overmap building hotspots: [x, y, w, h] percent boxes traced around each
// painted building (replaces the old one-size-fits-all box centered on pos).
// Re-measured 2026-07-19 for the NEW map art ("Game Map (12)")
var PP_MAP_BOXES = {
  lowCost:      [37.8, 59.5, 12.0, 29.0],
  luxury:       [77.5,  4.0, 17.8, 22.0],
  park:         [40.0, 25.5, 30.0, 31.0],
  airOne:       [19.3, 23.5,  6.9, 24.0],
  regretBurger: [63.9, 59.5, 11.4, 29.5],
  gym:          [20.8, 62.5, 15.5, 30.0],
  club:         [40.0,  2.0, 16.0, 23.0],
  temple:       [18.8, 44.0, 14.6, 19.5],
  university:   [20.5,  2.5, 16.5, 21.0],
  soulExchange: [84.5, 26.0, 15.0, 38.0],
  debtstreet:   [73.0, 27.5,  9.3, 26.5],
  airport:      [56.5,  2.0, 18.5, 24.0],
  petShop:      [75.5, 61.5, 13.5, 30.5],
  mall:         [50.0, 57.5, 13.8, 30.0]
};
// BDC side-menu card ids -> engine actions
var PP_BDC_MAP = {
  dance: "A050", flirt: "A051", digits: "A052",
  shots: "A053", vip: "A054", stranger: "A055", work: "A057"
};
if (typeof window !== "undefined") { window.PP_HOTSPOTS = PP_HOTSPOTS; window.PP_BDC_MAP = PP_BDC_MAP; window.PP_MAP_BOXES = PP_MAP_BOXES; }
if (typeof module !== "undefined") module.exports = { PP_HOTSPOTS: PP_HOTSPOTS, PP_BDC_MAP: PP_BDC_MAP, PP_MAP_BOXES: PP_MAP_BOXES };
