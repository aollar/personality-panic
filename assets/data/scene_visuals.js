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

  // Updated first STYLE page. Existing pages 2-3 remain until replacement art exists.
  PAGES.mall.tabs[0].pages[0].img = V3 + "mall_style_page_1.png";

  // Low-Cost Housing: ghosted starter unit plus the redesigned rent office.
  PAGES.lowCost.tabs[0].pages[0].img = V3 + "low-cost/unit_empty.png";
  PAGES.lowCost.tabs[0].pages[0].homeLayer = "lowCost";
  PAGES.lowCost.tabs[1].pages[0].img = V3 + "low-cost/rent_office.png";

  // Heelton Heights has two navigable rooms. The bedroom view was supplied
  // without its arrow, so its only live arrow receives a visible CSS treatment.
  PAGES.luxury.tabs[0].pages = [
    {
      img: V3 + "heelton/bedroom_empty.png",
      homeLayer: "luxuryBedroom",
      arrows: { prev: [0, 0, 0, 0], next: [1.15, 19.4, 5.25, 9.2] },
      visibleNextArrow: true,
      hotspots: [
        { a: "A009", box: [76.5, 16.0, 10.0, 17.0] },
        { a: "A010", box: [87.0, 16.0, 11.0, 17.0] },
        { a: "A011", box: [76.5, 34.0, 10.0, 16.0] },
        { a: "A012", box: [87.0, 34.0, 11.0, 16.0] },
        { a: "A013", box: [76.5, 50.5, 10.0, 15.0] },
        { a: "A014", box: [87.0, 50.5, 11.0, 15.0] },
        { a: "A015", box: [76.5, 66.0, 10.0, 12.0] },
        { a: "A016", box: [87.0, 66.0, 11.0, 12.0] },
        { a: "A009", box: [76.5, 79.0, 21.5, 17.0] }
      ]
    },
    {
      img: V3 + "heelton/lounge_empty.png",
      homeLayer: "luxuryLounge",
      arrows: { prev: [1.15, 19.4, 5.25, 9.2], next: [0, 0, 0, 0] },
      hotspots: [
        { a: "A009", box: [76.5, 16.0, 10.0, 17.0] },
        { a: "A010", box: [87.0, 16.0, 11.0, 17.0] },
        { a: "A011", box: [76.5, 34.0, 10.0, 16.0] },
        { a: "A012", box: [87.0, 34.0, 11.0, 16.0] },
        { a: "A013", box: [76.5, 50.5, 10.0, 15.0] },
        { a: "A014", box: [87.0, 50.5, 11.0, 15.0] },
        { a: "A015", box: [76.5, 66.0, 10.0, 12.0] },
        { a: "A016", box: [87.0, 66.0, 11.0, 12.0] },
        { a: "A009", box: [76.5, 79.0, 21.5, 17.0] }
      ]
    }
  ];
  PAGES.luxury.tabs[1].pages[0].img = V3 + "heelton/rent_office.png";
  PAGES.luxury.tabs[1].pages[0].hotspots = [
    { a: "X007", aByHousing: { resident: "X007", visitor: "X003" }, box: [75.5, 89.0, 21.7, 7.0] }
  ];

  // University now exposes the supplied PAGE 1 / PAGE 2 art and actions.
  PAGES.university = {
    tabBar: [],
    work: { a: "A075", box: [78.0, 84.0, 20.5, 14.5] },
    tabs: [{ id: "academic", label: "ACADEMIC CRISIS", pages: [
      {
        img: V3 + "high_iq_university_page_1.png",
        arrows: { prev: [0, 0, 0, 0], next: [88.7, 78.7, 4.2, 5.9] },
        hotspots: [
          { a: "A067", box: [75.0, 12.2, 11.6, 22.2] },
          { a: "A068", box: [87.0, 12.2, 11.5, 22.2] },
          { a: "A069", box: [75.0, 35.1, 11.6, 22.1] },
          { a: "A070", box: [87.0, 35.1, 11.5, 22.1] },
          { a: "A071", box: [75.0, 58.1, 11.6, 21.0] },
          { a: "A072", box: [87.0, 58.1, 11.5, 21.0] }
        ]
      },
      {
        img: V3 + "high_iq_university_page_2.png",
        arrows: { prev: [82.7, 78.4, 4.2, 6.2], next: [0, 0, 0, 0] },
        hotspots: [
          { a: "A073", box: [75.0, 12.2, 11.6, 22.3] },
          { a: "A074", box: [87.0, 12.2, 11.5, 22.3] }
        ]
      }
    ] }]
  };

  // Airport page 2 contains the two utility actions omitted from page 1.
  PAGES.airport = {
    tabBar: [],
    work: { a: "A101", box: [74.16, 85.65, 24.28, 13.15] },
    tabs: [{ id: "escape", label: "ESCAPE PLAN", pages: [
      {
        img: V3 + "airport.png",
        arrows: { prev: [0, 0, 0, 0], next: [89.60, 78.43, 3.40, 6.10] },
        hotspots: [
          { a: "A093", box: [73.9, 10.6, 11.5, 24.5] },
          { a: "A094", box: [85.8, 10.6, 12.9, 24.5] },
          { a: "A095", box: [73.9, 37.0, 11.5, 22.5] },
          { a: "A096", box: [85.8, 37.0, 12.9, 22.5] },
          { a: "A097", box: [73.9, 60.1, 11.5, 21.7] },
          { a: "A098", box: [85.8, 60.1, 12.9, 21.7] }
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
