/*
 * PERSONALITY PANIC — v3 scene-art overrides and apartment layer manifest.
 *
 * The generated Balance Lock data stays untouched. This file replaces only
 * visual filenames and describes which aligned furniture/pet layers appear
 * when the active player owns the matching game item.
 */
(function () {
  "use strict";

  var DATA = typeof PP_DATA !== "undefined" ? PP_DATA : null;
  var PAGES = typeof PP_SCENE_PAGES !== "undefined" ? PP_SCENE_PAGES : null;
  if (!DATA || !PAGES) return;

  var V3 = "v3/";
  var scenes = {
    airOne: V3 + "air_one.png",
    airport: V3 + "airport.png",
    gym: V3 + "bro_science_gym.png",
    soulExchange: V3 + "corporate_soul_exchange.png",
    debtstreet: V3 + "debtstreet_capital.png",
    temple: V3 + "re_education_temple.png",
    regretBurger: V3 + "regret_burger.png",
    park: V3 + "park.png"
  };
  Object.keys(scenes).forEach(function (id) {
    if (DATA.buildings[id]) DATA.buildings[id].scene = scenes[id];
  });

  // Mall (2026-09-16 repaint): STYLE and GEAR use the new 3x3 layout. HOME keeps
  // its older 2-column art until the extra furniture items are decided; its
  // painted prices predate v5, so live price tags cover them (hotspot.price).
  // price.painted = the number painted in the art; the live tag only appears
  // when the real price differs (always true for Medium/Long games).
  function grid3(cols, rows, items) {
    return items.map(function (it, i) {
      var c = cols[i % 3], r = rows[Math.floor(i / 3)];
      var h = { a: it[0], choice: { item: it[1] }, box: [c[0], r[0], c[1] - c[0], r[1] - r[0]] };
      if (it[2]) h.price = it[2];
      return h;
    });
  }
  var NEW_TABS = function (y, h) {
    return [
      { tab: "style", box: [72.9, y, 8.5, h] },
      { tab: "gear",  box: [81.8, y, 8.0, h] },
      { tab: "home",  box: [90.3, y, 8.0, h] }
    ];
  };
  var STYLE_COLS = [[72.8, 81.0], [81.4, 90.0], [90.5, 98.9]];
  PAGES.mall.tabs[0].pages = [
    {
      img: V3 + "mall_style_page_1.png",
      tabBar: NEW_TABS(10.4, 4.6),
      arrows: { prev: [78.6, 75.8, 3.0, 5.4], next: [89.8, 75.8, 3.0, 5.4] },
      work: { a: "A118", box: [76.4, 82.9, 21.0, 14.5] },
      hotspots: grid3(STYLE_COLS, [[17.0, 35.8], [37.0, 55.6], [56.7, 75.4]], [
        ["A115", "Casual Clothes"], ["A115", "Smart Clothes"], ["A115", "Business Clothes"],
        ["A115", "Dressy Clothes"], ["A115", "Dress Shoes"], ["A115", "Sunglasses"],
        ["A115", "Earrings"], ["A115", "Bracelet"], ["A115", "Rings"]
      ])
    },
    {
      // old prices and two penalty marks were erased from this art; live text replaces the prices
      img: V3 + "mall_style_page_2.png",
      tabBar: NEW_TABS(10.0, 4.6),
      arrows: { prev: [78.6, 75.8, 3.0, 5.4], next: [89.8, 75.8, 3.0, 5.4] },
      work: { a: "A118", box: [76.4, 82.9, 21.0, 14.5] },
      hotspots: grid3(STYLE_COLS, [[16.4, 36.0], [37.3, 57.0]], [
        ["A113", "Watch", { box: [76.2, 17.0, 4.5, 3.6], style: "text" }],
        ["A115", "Cap", { box: [85.3, 17.0, 4.5, 3.6], style: "text" }],
        ["A115", "Durag", { box: [94.2, 17.0, 4.5, 3.6], style: "text" }],
        ["A115", "High Heels", { box: [76.2, 37.9, 4.5, 3.6], style: "text" }],
        ["A115", "Crocodile Sandals", { box: [85.3, 37.9, 4.5, 3.6], style: "text" }]
      ])
    }
  ];
  PAGES.mall.tabs[1].pages = [
    {
      img: V3 + "mall_gear_page_1.png",
      tabBar: NEW_TABS(9.9, 4.6),
      arrows: { prev: [78.4, 76.4, 3.0, 5.4], next: [89.5, 76.4, 3.0, 5.4] },
      work: { a: "A118", box: [78.7, 82.2, 18.6, 15.6] },
      hotspots: grid3([[72.8, 81.0], [81.4, 89.8], [90.1, 98.4]], [[14.7, 35.1], [36.1, 55.0], [56.1, 76.5]], [
        ["A112", "Bus Pass"], ["A112", "Bicycle"], ["A112", "Car"],
        ["A113", "Mobile Phone"], ["A113", "Computer"], ["A113", "Camera"],
        ["A113", "TV"], ["A113", "Blu-ray"], ["A113", "E-reader"]
      ])
    },
    {
      img: V3 + "mall_gear_page_2.png",
      tabBar: NEW_TABS(10.0, 4.6),
      arrows: { prev: [78.6, 75.8, 3.0, 5.4], next: [89.8, 75.8, 3.0, 5.4] },
      work: { a: "A118", box: [76.4, 82.4, 21.0, 14.5] },
      hotspots: grid3(STYLE_COLS, [[16.4, 35.9]], [["A113", "Stereo"]])
    }
  ];
  // HOME: old 2-column art, re-measured, with live price tags over the painted ones
  function home2(rows, tagRows, items, arrows, featured) {
    var cols = [[70.8, 83.5], [84.4, 97.3]], tagX = [79.6, 93.4];
    return {
      arrows: arrows,
      priceTags: featured ? [featured] : [],
      hotspots: items.map(function (it, i) {
        var c = cols[i % 2], r = rows[Math.floor(i / 2)], t = tagRows[Math.floor(i / 2)];
        return { a: it[0], choice: { item: it[1] }, box: [c[0], r[0], c[1] - c[0], r[1] - r[0]],
                 price: { box: [tagX[i % 2], t[0], 3.9, t[1] - t[0]], style: "tag", painted: it[2] } };
      })
    };
  }
  var homeImgs = PAGES.mall.tabs[2].pages.map(function (pg) { return pg.img; });
  PAGES.mall.tabs[2].pages = [
    home2([[15.9, 32.4], [33.4, 49.6], [50.4, 66.4]], [[16.0, 20.2], [32.9, 37.0], [49.9, 54.0]], [
      ["A114", "Lumpy Bed", 5], ["A114", "Nice Bed", 12], ["A114", "Premium Bed", 25],
      ["A114", "Couch", 12], ["A114", "Bookshelf", 10], ["A114", "Plants", 6]
    ], { prev: [75.6, 66.0, 4.1, 4.7], next: [86.9, 66.0, 4.2, 4.7] },
    { item: "Lumpy Bed", box: [93.2, 72.4, 4.0, 4.6], style: "dark", painted: 5 }),
    home2([[15.9, 33.0], [34.4, 50.9], [52.3, 68.6]], [[15.9, 20.3], [34.1, 38.6], [52.1, 56.4]], [
      ["A114", "Desk", 12], ["A114", "Ergonomic Chair", 14], ["A114", "Pet Bed", 8],
      ["A114", "Pet Toys", 5], ["A114", "Dining Table", 15], ["A114", "Mirror", 8]
    ], { prev: [75.6, 69.5, 4.0, 4.1], next: [87.1, 69.5, 4.1, 4.1] },
    { item: "Desk", box: [92.1, 75.5, 4.6, 4.6], style: "dark", painted: 12 }),
    home2([[15.9, 33.0], [34.4, 50.4], [51.6, 67.8]], [[15.9, 20.3], [34.1, 38.2], [51.3, 55.4]], [
      ["A113", "Fridge", 20], ["A113", "Stove", 18], ["A113", "Vacuum", 10],
      ["A113", "Cold Plunge", 30], ["A113", "Hot Tub", 40]
    ], { prev: [74.6, 67.8, 4.6, 4.8], next: [88.2, 67.8, 4.6, 4.8] },
    { item: "Fridge", box: [92.8, 74.8, 4.4, 5.0], style: "dark", painted: 20 })
  ];
  PAGES.mall.tabs[2].pages.forEach(function (pg, i) { pg.img = homeImgs[i]; });

  // Low-Cost Housing: ghosted starter unit plus the redesigned rent office.
  PAGES.lowCost.tabs[0].pages[0].img = V3 + "low-cost/unit_empty.png";
  PAGES.lowCost.tabs[0].pages[0].homeLayer = "lowCost";
  PAGES.lowCost.tabBar = [
    { tab: "unit", box: [72.8, 12.0, 12.5, 5.2] },
    { tab: "rent", box: [85.5, 12.0, 12.5, 5.2] }
  ];
  PAGES.lowCost.tabs[0].pages[0].hotspots = [
    { a: "A001", box: [72.8, 16.7, 12.1, 18.5] },
    { a: "A002", box: [85.2, 16.7, 13.1, 18.5] },
    { a: "A003", box: [72.8, 36.8, 12.1, 19.3] },
    { a: "A004", box: [85.2, 36.8, 13.1, 19.3] },
    { a: "A005", box: [72.8, 58.0, 12.1, 18.0] },
    { a: "A006", box: [85.2, 58.0, 13.1, 18.0] },
    { a: "A007", box: [72.8, 77.7, 25.5, 17.0] }
  ];
  PAGES.lowCost.tabs[1].pages[0].img = V3 + "low-cost/rent_office.png";
  PAGES.lowCost.tabs[1].pages[0].hotspots = [
    { a: "X006", aByHousing: { low: "X006", lux: "X004", homeless: "X005" }, box: [74.8, 18.8, 11.5, 23.2] },
    { a: "X006", aByHousing: { low: "X006", lux: "X004", homeless: "X005" }, box: [74.8, 80.5, 22.6, 11.0] }
  ];

  // Heelton Heights has two navigable rooms. The bedroom view was supplied
  // without its arrow, so its only live arrow receives a visible CSS treatment.
  PAGES.luxury.tabBar = [
    { tab: "suite", box: [75.9, 11.8, 11.2, 3.8] },
    { tab: "rent", box: [87.2, 11.8, 10.7, 3.8] }
  ];
  // Heelton suite (2026-09-17 repaint): the same painted menu panel sits on both
  // rooms. Page 1 (bedroom) holds the eight suite actions, page 2 (lounge) holds
  // Play With Pet, and the panel's own gold arrows flip between them.
  var luxuryBedroomActions = [
    { a: "A009", box: [76.2, 16.5, 10.3, 19.4] },
    { a: "A010", box: [87.2, 16.5, 10.7, 19.4] },
    { a: "A011", box: [76.2, 36.9, 10.3, 18.8] },
    { a: "A012", box: [87.2, 36.9, 10.7, 18.8] },
    { a: "A013", box: [76.2, 56.8, 10.3, 18.0] },
    { a: "A014", box: [87.2, 56.8, 10.7, 18.0] },
    { a: "A015", box: [76.2, 75.7, 10.3, 15.3] },
    { a: "A016", box: [87.2, 75.7, 10.7, 15.3] }
  ];
  var SUITE_ARROWS = { prev: [79.5, 92.2, 2.6, 4.8], next: [91.5, 92.2, 2.6, 4.8] };
  PAGES.luxury.tabs[0].pages = [
    {
      img: V3 + "heelton/bedroom_empty.png",
      homeLayer: "luxuryBedroom",
      arrows: { prev: [0, 0, 0, 0], next: SUITE_ARROWS.next },
      hotspots: luxuryBedroomActions.map(function (h) { return { a: h.a, box: h.box.slice() }; })
    },
    {
      img: V3 + "heelton/lounge_empty.png",
      homeLayer: "luxuryLounge",
      arrows: { prev: SUITE_ARROWS.prev, next: [0, 0, 0, 0] },
      hotspots: [{ a: "X014", box: [76.2, 16.5, 10.3, 19.4] }]
    }
  ];
  PAGES.luxury.tabs[1].pages[0].img = V3 + "heelton/rent_office.png";
  PAGES.luxury.tabs[1].pages[0].hotspots = [
    // the painted PAY HEELTON RENT card was dead in the playtest build — it is
    // now wired to the same action as the green button below it
    { a: "X007", aByHousing: { lux: "X007", low: "X003", homeless: "X009" }, box: [75.6, 17.5, 11.2, 21.0] },
    { a: "X007", aByHousing: { lux: "X007", low: "X003", homeless: "X009" }, box: [75.0, 86.7, 22.5, 9.0] }
  ];

  // University now exposes the supplied PAGE 1 / PAGE 2 art and actions.
  PAGES.university = {
    tabBar: [],
    work: { a: "A075", box: [75.4, 84.5, 23.4, 14.8] },
    tabs: [{ id: "academic", label: "ACADEMIC CRISIS", pages: [
      {
        img: V3 + "high_iq_university_page_1.png",
        arrows: { prev: [0, 0, 0, 0], next: [88.7, 78.7, 4.2, 5.9] },
        hotspots: [
          // v5 repaint: one card per education path (opens the catalog on that path)
          { a: "A120", focusPath: 1, box: [75.0, 12.2, 11.6, 23.4] },
          { a: "A120", focusPath: 2, box: [87.0, 12.2, 11.5, 23.4] },
          { a: "A120", focusPath: 3, box: [75.0, 35.7, 11.6, 23.6] },
          { a: "A120", focusPath: 4, box: [87.0, 35.7, 11.5, 23.6] },
          { a: "A120", focusPath: 5, box: [75.0, 59.8, 11.6, 21.4] },
          { a: "A068", box: [87.0, 59.8, 11.5, 21.4] }
        ]
      },
      {
        img: V3 + "high_iq_university_page_2.png",
        arrows: { prev: [82.7, 78.4, 4.2, 6.2], next: [0, 0, 0, 0] },
        hotspots: [
          { a: "A073", box: [75.0, 12.2, 11.6, 24.3] },
          { a: "A074", box: [87.0, 12.2, 11.5, 24.3] },
          { a: "A069", box: [75.4, 38.2, 11.4, 21.9] }
        ]
      }
    ] }]
  };

  // Airport page 2 contains the two utility actions omitted from page 1.
  PAGES.airport = {
    tabBar: [],
    work: { a: "A101", box: [75.4, 84.7, 23.4, 14.8] },
    tabs: [{ id: "escape", label: "ESCAPE PLAN", pages: [
      {
        img: V3 + "airport.png",
        arrows: { prev: [0, 0, 0, 0], next: [89.60, 78.43, 3.40, 6.10] },
        hotspots: [
          { a: "A093", box: [72.7, 11.4, 12.7, 23.3] },
          { a: "A094", box: [85.6, 11.4, 13.5, 23.3] },
          { a: "A095", box: [72.7, 35.4, 12.7, 21.1] },
          { a: "A096", box: [85.6, 35.4, 13.5, 21.1] },
          { a: "A097", box: [72.7, 57.3, 12.7, 20.4] },
          { a: "A098", box: [85.6, 57.3, 13.5, 20.4] }
        ]
      },
      {
        img: V3 + "airport_page_2.png",
        arrows: { prev: [81.82, 78.43, 3.40, 6.10], next: [0, 0, 0, 0] },
        hotspots: [
          { a: "A099", box: [73.86, 10.95, 12.20, 25.08] },
          { a: "A100", box: [86.12, 10.95, 12.20, 25.08] }
        ]
      }
    ] }]
  };

  // Ethical Pet Shop keeps its existing art, but the old click grid was
  // narrower than the visible cards and missed much of the left edges.
  PAGES.petShop.tabBar = [
    { tab: "adopt",  box: [78.5, 5.0, 6.4, 4.8] },
    { tab: "care",   box: [85.2, 5.0, 6.7, 4.8] },
    { tab: "bribes", box: [92.2, 5.0, 6.8, 4.8] }
  ];
  PAGES.petShop.arrows = { prev: [81.8, 58.7, 3.8, 5.5], next: [91.0, 58.7, 3.8, 5.5] };
  PAGES.petShop.tabs[0].pages.forEach(function (page) {
    page.hotspots[0].box = [78.3, 12.2, 10.1, 22.3];
    page.hotspots[1].box = [88.5, 12.2, 10.7, 22.3];
    page.hotspots[2].box = [78.3, 35.0, 10.1, 22.5];
    page.hotspots[3].box = [88.5, 35.0, 10.7, 22.5];
    page.hotspots[4].box = [78.3, 63.0, 20.9, 21.8];
  });
  PAGES.petShop.tabs[1].pages[0].hotspots[0].box = [78.3, 12.2, 10.1, 22.3];
  PAGES.petShop.tabs[1].pages[0].hotspots[1].box = [88.5, 12.2, 10.7, 22.3];
  PAGES.petShop.tabs[1].pages[0].hotspots[2].box = [78.3, 35.0, 10.1, 22.5];
  PAGES.petShop.tabs[1].pages[0].hotspots[3].box = [88.5, 35.0, 10.7, 22.5];
  PAGES.petShop.tabs[1].pages[0].hotspots[4].box = [78.3, 61.0, 20.9, 22.5];
  PAGES.petShop.tabs[2].pages[0].hotspots[0].box = [78.3, 12.2, 10.1, 22.3];
  PAGES.petShop.tabs[2].pages[0].hotspots[1].box = [88.5, 12.2, 10.7, 22.3];
  PAGES.petShop.tabs[2].pages[0].hotspots[2].box = [78.3, 63.0, 20.9, 21.8];

  var PET_FILES = {
    ESFJ: "pet_dog.png",
    ENFJ: "pet_lion.png",
    ENFP: "pet_otter.png",
    ESFP: "pet_piggy.png"
  };

  // Clips use source-image pixels on the fixed 1672x941 canvas. The runtime
  // removes only border-connected white pixels, preserving the authored art.
  var homes = {
    lowCost: {
      sourceRoot: V3 + "low-cost/",
      base: V3 + "low-cost/unit_empty.png",
      alpha: true,
      complete: { src: "furniture_lumpy.png", groups: [["Lumpy Bed"], ["Stove"], ["Fridge"], ["TV"], ["Couch"], ["Pet Bed", "Pet Toys"]] },
      layers: [
        { any: ["Lumpy Bed"], src: "furniture_lumpy.png", clips: [[210, 250, 350, 285]] },
        { any: ["Nice Bed", "Premium Bed"], src: "furniture_nice.png", clips: [[210, 250, 350, 285]] },
        { any: ["Stove"], src: "furniture_lumpy.png", clips: [[985, 276, 160, 155]] },
        { any: ["Fridge"], src: "furniture_lumpy.png", clips: [[980, 385, 165, 145]] },
        { any: ["TV"], src: "furniture_lumpy.png", clips: [[945, 500, 205, 195]] },
        { any: ["Couch"], src: "furniture_lumpy.png", clips: [[390, 515, 225, 190]] },
        { any: ["Pet Bed", "Pet Toys"], src: "furniture_lumpy.png", clips: [[225, 675, 135, 85]] }
      ],
      pets: PET_FILES
    },
    luxuryBedroom: {
      sourceRoot: V3 + "heelton/",
      base: V3 + "heelton/bedroom_empty.png",
      alpha: true,
      completeBackdrop: V3 + "heelton/bedroom_complete.png",
      complete: { src: "bedroom_furniture.png", groups: [["Lumpy Bed", "Nice Bed", "Premium Bed"], ["Stove"], ["Fridge"], ["Desk", "Ergonomic Chair", "Computer"], ["Couch"], ["Plants"]] },
      layers: [
        { any: ["Lumpy Bed", "Nice Bed", "Premium Bed"], src: "bedroom_furniture.png", clips: [[230, 10, 565, 440]] },
        { any: ["Stove"], src: "bedroom_furniture.png", clips: [[600, 0, 205, 335]] },
        { any: ["Fridge"], src: "bedroom_furniture.png", clips: [[920, 65, 180, 330]] },
        { any: ["Desk", "Ergonomic Chair", "Computer"], src: "bedroom_furniture.png", clips: [[995, 295, 300, 315]] },
        { any: ["Couch"], src: "bedroom_furniture.png", clips: [[520, 405, 585, 420]] },
        { any: ["Plants"], src: "bedroom_furniture.png", clips: [[0, 225, 170, 410], [1005, 35, 205, 390]] }
      ],
      pets: PET_FILES
    },
    luxuryLounge: {
      sourceRoot: V3 + "heelton/",
      base: V3 + "heelton/lounge_empty.png",
      alpha: true,
      completeBackdrop: V3 + "heelton/lounge_complete.png",
      complete: { src: "lounge_furniture.png", groups: [["TV"], ["Bookshelf"], ["Dining Table"], ["Mirror"], ["Hot Tub"], ["Vacuum"], ["Couch"], ["Plants"]] },
      layers: [
        { any: ["TV"], src: "lounge_furniture.png", clips: [[340, 90, 350, 375]] },
        { any: ["Bookshelf"], src: "lounge_furniture.png", clips: [[265, 25, 115, 445], [625, 25, 120, 445]] },
        { any: ["Dining Table"], src: "lounge_furniture.png", clips: [[660, 155, 385, 350]] },
        { any: ["Mirror"], src: "lounge_furniture.png", clips: [[935, 40, 155, 355]] },
        { any: ["Hot Tub"], src: "lounge_furniture.png", clips: [[995, 265, 285, 315]] },
        { any: ["Vacuum"], src: "lounge_furniture.png", clips: [[1080, 455, 205, 365]] },
        { any: ["Couch"], src: "lounge_furniture.png", clips: [[205, 355, 855, 540]] },
        { any: ["Plants"], src: "lounge_furniture.png", clips: [[170, 230, 180, 275], [790, 120, 205, 275]] }
      ],
      pets: PET_FILES
    }
  };

  var manifest = { version: 3, scenes: scenes, homes: homes };
  if (typeof window !== "undefined") window.PP_SCENE_VISUALS = manifest;
  if (typeof module !== "undefined") module.exports = manifest;
})();
