/*
 * PERSONALITY PANIC — paged / tabbed painted-menu scenes.
 *
 * Some scenes have a MULTI-TAB, MULTI-PAGE menu painted into the art
 * (Ethical Pet Shop: ADOPT/PET CARE/BRIBES · Mall: STYLE/GEAR/HOME ·
 * Low-Cost Housing: UNIT ACTIONS/PAY RENT). This file describes those scenes so
 * the tab buttons switch tabs and the ◀ ▶ arrows scroll pages — each page swaps
 * the backdrop image and rebuilds the transparent hotspot layer.
 *
 * Geometry is percent of the 1672x941 scene image: box = [x, y, w, h].
 *
 * Per building:
 *   tabBar : tab buttons baked into EVERY page (same spot on each image).
 *   arrows : {prev,next} default ◀ ▶ boxes; a page may override with its own
 *            `arrows` (2-col vs 3-col art puts the arrow row at different heights).
 *   work   : the WORK button baked into every page (optional).
 *   tabs[] : { id, label, pages:[ { img, arrows?, hotspots:[ {a, choice?, box} ] } ] }
 *            a = Action_ID; choice = pre-made choice so the action fires directly
 *            (no modal): {pet:"ESTJ"} for Adopt, {item:"Cap"} for a mall shop.
 *   >1 page in a tab auto-shows the ◀ N/M ▶ arrows.
 */

// build item hotspots from a grid + [name, actionId] pairs (mall shops)
function ppItemGrid(items, g) {
  return items.map(function (it, i) {
    var c = i % g.cols, r = Math.floor(i / g.cols);
    return { a: it[1], choice: { item: it[0] }, box: [g.x0 + c * g.dx, g.y0 + r * g.dy, g.w, g.h] };
  });
}
// build plain action hotspots from a grid + actionId list (housing unit actions)
function ppActGrid(ids, g) {
  return ids.map(function (id, i) {
    var c = i % g.cols, r = Math.floor(i / g.cols);
    return { a: id, box: [g.x0 + c * g.dx, g.y0 + r * g.dy, g.w, g.h] };
  });
}

// ---- Mall menu geometry (right panel, "RETAIL THERAPY REVIEW") ----
var MG3 = { cols: 3, x0: 70.6, dx: 9.65, w: 9.0, y0: 16.8, dy: 18.4, h: 16.6 };   // 3-col x 2-row pages
var MG2 = { cols: 2, x0: 70.6, dx: 14.15, w: 13.4, y0: 16.0, dy: 16.3, h: 14.6 }; // 2-col x 3-row pages
var ARR_M3 = { prev: [77.7, 55.4, 4.8, 6.6], next: [85.6, 55.4, 4.8, 6.6] }; // on the ◀ ▶ glyphs (3-col page)
var ARR_M2 = { prev: [77.7, 63.2, 4.8, 6.8], next: [85.6, 63.2, 4.8, 6.8] }; // on the ◀ ▶ glyphs (2-col page)
var MALL_TABS = [
  { tab: "style", box: [70.4, 9.4, 10.2, 5.6] },
  { tab: "gear",  box: [81.0, 9.4, 8.8, 5.6] },
  { tab: "home",  box: [90.0, 9.4, 8.6, 5.6] }
];

// ---- Low-Cost Housing menu geometry ("UNIT REVIEW") ----
var HG = { cols: 2, x0: 72.3, dx: 13.0, w: 12.3, y0: 14.8, dy: 15.6, h: 14.2 };

var PP_SCENE_PAGES = {
  petShop: {
    tabBar: [{ tab: "adopt", box: [79.4, 5.4, 6.4, 4.4] }, { tab: "care", box: [86.1, 5.4, 6.6, 4.4] }, { tab: "bribes", box: [93.0, 5.4, 6.0, 4.4] }],
    arrows: { prev: [81.4, 58.8, 5.0, 5.6], next: [88.6, 58.8, 5.0, 5.6] },
    work: { a: "A110", box: [86.5, 89.0, 12.5, 10.0] },
    tabs: [
      { id: "adopt", label: "ADOPT", pages: [
        { img: "pet_adopt_1.jpg", hotspots: [
          { a: "A102", choice: { pet: "ESFJ" }, box: [79.9, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ENFJ" }, box: [89.0, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ENFP" }, box: [79.9, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ESFP" }, box: [89.0, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ESFJ" }, box: [79.9, 63.5, 18.0, 21.5] }
        ]},
        { img: "pet_adopt_2.jpg", hotspots: [
          { a: "A102", choice: { pet: "ESTJ" }, box: [79.9, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ENTJ" }, box: [89.0, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ENTP" }, box: [79.9, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ESTP" }, box: [89.0, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ESTJ" }, box: [79.9, 63.5, 18.0, 21.5] }
        ]},
        { img: "pet_adopt_3.jpg", hotspots: [
          { a: "A102", choice: { pet: "ISFJ" }, box: [79.9, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "INFJ" }, box: [89.0, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "INFP" }, box: [79.9, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ISFP" }, box: [89.0, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ISFJ" }, box: [79.9, 63.5, 18.0, 21.5] }
        ]},
        { img: "pet_adopt_4.jpg", hotspots: [
          { a: "A102", choice: { pet: "ISTJ" }, box: [79.9, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ISTP" }, box: [89.0, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "INTJ" }, box: [79.9, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "INTP" }, box: [89.0, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ISTJ" }, box: [79.9, 63.5, 18.0, 21.5] }
        ]}
      ]},
      { id: "care", label: "PET CARE", pages: [
        { img: "pet_care.jpg", hotspots: [
          { a: "A103", box: [79.9, 13.4, 8.9, 21.4] },
          { a: "A104", box: [89.0, 13.4, 8.9, 21.4] },
          { a: "A105", box: [79.9, 35.0, 8.9, 21.4] },
          { a: "A106", box: [89.0, 35.0, 8.9, 21.4] },
          { a: "A107", box: [79.9, 61.0, 18.0, 22.0] }
        ]}
      ]},
      { id: "bribes", label: "BRIBES", pages: [
        { img: "pet_bribes.jpg", hotspots: [
          { a: "A108", box: [79.9, 13.4, 8.9, 21.4] },
          { a: "A109", box: [89.0, 13.4, 8.9, 21.4] },
          { a: "A108", box: [79.9, 63.5, 18.0, 21.5] }
        ]}
      ]}
    ]
  },
  mall: {
    tabBar: [{ tab: "style", box: [70.4, 9.4, 10.2, 5.6] }, { tab: "gear", box: [81.0, 9.4, 8.8, 5.6] }, { tab: "home", box: [90.0, 9.4, 8.6, 5.6] }],
    work: { a: "A118", box: [81.0, 85.3, 17.7, 11.2] },
    tabs: [
      { id: "style", label: "STYLE", pages: [
        { img: "mall.jpg", arrows: { prev: [76.8, 55.7, 3.1, 5.4], next: [88.2, 56.0, 3.1, 5.1] }, hotspots: [
          { a: "A115", choice: { item: "Casual Clothes" }, box: [70.3, 16.4, 8.9, 19.2] },
          { a: "A115", choice: { item: "Smart Clothes" }, box: [79.7, 16.8, 8.9, 19.0] },
          { a: "A115", choice: { item: "Business Clothes" }, box: [88.8, 16.5, 9.3, 19.3] },
          { a: "A115", choice: { item: "Dressy Clothes" }, box: [70.6, 36.9, 8.7, 18.7] },
          { a: "A115", choice: { item: "Dress Shoes" }, box: [79.6, 36.9, 8.9, 18.8] },
          { a: "A115", choice: { item: "Sunglasses" }, box: [89.0, 36.8, 8.9, 18.8] }
        ]},
        { img: "mall_style_2.jpg", arrows: { prev: [77.7, 55.4, 4.8, 6.6], next: [85.6, 55.4, 4.8, 6.6] }, hotspots: [
          { a: "A115", choice: { item: "Earrings" }, box: [70.6, 16.8, 9.0, 16.6] },
          { a: "A115", choice: { item: "Bracelet" }, box: [80.2, 16.8, 9.0, 16.6] },
          { a: "A115", choice: { item: "Rings" }, box: [89.9, 16.8, 9.0, 16.6] },
          { a: "A115", choice: { item: "High Heels" }, box: [70.6, 35.2, 9.0, 16.6] },
          { a: "A115", choice: { item: "Crocodile Sandals" }, box: [80.2, 35.2, 9.0, 16.6] },
          { a: "A115", choice: { item: "Durag" }, box: [89.9, 35.2, 9.0, 16.6] }
        ]},
        { img: "mall_style_3.jpg", arrows: { prev: [77.7, 55.4, 4.8, 6.6], next: [85.6, 55.4, 4.8, 6.6] }, hotspots: [
          { a: "A113", choice: { item: "Watch" }, box: [70.6, 16.8, 9.0, 16.6] },
          { a: "A115", choice: { item: "Cap" }, box: [80.2, 16.8, 9.0, 16.6] }
        ]}
      ]},
      { id: "gear", label: "GEAR", pages: [
        { img: "mall_gear_1.jpg", arrows: { prev: [77.7, 63.2, 4.8, 6.8], next: [85.6, 63.2, 4.8, 6.8] }, hotspots: [
          { a: "A112", choice: { item: "Bus Pass" }, box: [70.6, 16.0, 13.4, 14.6] },
          { a: "A112", choice: { item: "Bicycle" }, box: [84.8, 16.0, 13.4, 14.6] },
          { a: "A112", choice: { item: "Car" }, box: [70.6, 32.3, 13.4, 14.6] },
          { a: "A113", choice: { item: "Mobile Phone" }, box: [84.8, 32.3, 13.4, 14.6] },
          { a: "A113", choice: { item: "Computer" }, box: [70.6, 48.6, 13.4, 14.6] },
          { a: "A113", choice: { item: "Camera" }, box: [84.8, 48.6, 13.4, 14.6] }
        ]},
        { img: "mall_gear_2.jpg", arrows: { prev: [77.7, 55.4, 4.8, 6.6], next: [85.6, 55.4, 4.8, 6.6] }, hotspots: [
          { a: "A113", choice: { item: "TV" }, box: [70.6, 16.8, 9.0, 16.6] },
          { a: "A113", choice: { item: "Blu-ray" }, box: [80.2, 16.8, 9.0, 16.6] },
          { a: "A113", choice: { item: "E-reader" }, box: [89.9, 16.8, 9.0, 16.6] },
          { a: "A113", choice: { item: "Stereo" }, box: [70.6, 35.2, 9.0, 16.6] }
        ]}
      ]},
      { id: "home", label: "HOME", pages: [
        { img: "mall_home_1.jpg", arrows: { prev: [77.7, 63.2, 4.8, 6.8], next: [85.6, 63.2, 4.8, 6.8] }, hotspots: [
          { a: "A114", choice: { item: "Lumpy Bed" }, box: [70.6, 16.0, 13.4, 14.6] },
          { a: "A114", choice: { item: "Nice Bed" }, box: [84.8, 16.0, 13.4, 14.6] },
          { a: "A114", choice: { item: "Premium Bed" }, box: [70.6, 32.3, 13.4, 14.6] },
          { a: "A114", choice: { item: "Couch" }, box: [84.8, 32.3, 13.4, 14.6] },
          { a: "A114", choice: { item: "Bookshelf" }, box: [70.6, 48.6, 13.4, 14.6] },
          { a: "A114", choice: { item: "Plants" }, box: [84.8, 48.6, 13.4, 14.6] }
        ]},
        { img: "mall_home_2.jpg", arrows: { prev: [77.7, 63.2, 4.8, 6.8], next: [85.6, 63.2, 4.8, 6.8] }, hotspots: [
          { a: "A114", choice: { item: "Desk" }, box: [70.6, 16.0, 13.4, 14.6] },
          { a: "A114", choice: { item: "Ergonomic Chair" }, box: [84.8, 16.0, 13.4, 14.6] },
          { a: "A114", choice: { item: "Pet Bed" }, box: [70.6, 32.3, 13.4, 14.6] },
          { a: "A114", choice: { item: "Pet Toys" }, box: [84.8, 32.3, 13.4, 14.6] },
          { a: "A114", choice: { item: "Dining Table" }, box: [70.6, 48.6, 13.4, 14.6] },
          { a: "A114", choice: { item: "Mirror" }, box: [84.8, 48.6, 13.4, 14.6] }
        ]},
        { img: "mall_home_3.jpg", arrows: { prev: [77.7, 63.2, 4.8, 6.8], next: [85.6, 63.2, 4.8, 6.8] }, hotspots: [
          { a: "A113", choice: { item: "Fridge" }, box: [70.6, 16.0, 13.4, 14.6] },
          { a: "A113", choice: { item: "Stove" }, box: [84.8, 16.0, 13.4, 14.6] },
          { a: "A113", choice: { item: "Vacuum" }, box: [70.6, 32.3, 13.4, 14.6] },
          { a: "A113", choice: { item: "Cold Plunge" }, box: [84.8, 32.3, 13.4, 14.6] },
          { a: "A113", choice: { item: "Hot Tub" }, box: [70.6, 48.6, 13.4, 14.6] }
        ]}
      ]}
    ]
  },
  luxury: {
    tabBar: [{ tab: "suite", box: [76.3, 9.5, 11.0, 4.3] }, { tab: "rent", box: [87.0, 10.0, 11.3, 4.8] }],
    tabs: [
      { id: "suite", label: "SUITE ACTIONS", pages: [
        { img: "luxury_apartments.jpg", hotspots: [
          { a: "A009", box: [76.5, 16.0, 10.0, 17.0] },
          { a: "A010", box: [87.0, 16.0, 11.0, 17.0] },
          { a: "A011", box: [76.5, 34.0, 10.0, 16.0] },
          { a: "A012", box: [87.0, 34.0, 11.0, 16.0] },
          { a: "A013", box: [76.5, 50.5, 10.0, 15.0] },
          { a: "A014", box: [87.0, 50.5, 11.0, 15.0] },
          { a: "A015", box: [76.5, 66.0, 10.0, 12.0] },
          { a: "A016", box: [87.0, 66.0, 11.0, 12.0] },
          { a: "A009", box: [76.5, 79.0, 21.5, 17.0] }
        ]}
      ]},
      { id: "rent", label: "PAY RENT", pages: [
        { img: "luxury_rent.jpg", hotspots: [
          { a: "X007", box: [75.5, 89.0, 21.7, 7.0] }
        ]}
      ]}
    ]
  },
  lowCost: {
    tabBar: [{ tab: "unit", box: [72.8, 7.8, 12.5, 5.2] }, { tab: "rent", box: [85.5, 7.8, 12.5, 5.2] }],
    tabs: [
      { id: "unit", label: "UNIT ACTIONS", pages: [
        { img: "house_unit.jpg", hotspots: [
          { a: "A001", box: [72.3, 14.8, 12.3, 14.2] },
          { a: "A002", box: [85.3, 14.8, 12.3, 14.2] },
          { a: "A003", box: [72.3, 30.4, 12.3, 14.2] },
          { a: "A004", box: [85.3, 30.4, 12.3, 14.2] },
          { a: "A005", box: [72.3, 46.0, 12.3, 14.2] },
          { a: "A006", box: [85.3, 46.0, 12.3, 14.2] },
          { a: "A007", box: [72.3, 61.6, 12.3, 14.2] }
        ]}
      ]},
      { id: "rent", label: "PAY RENT", pages: [
        { img: "house_rent.jpg", hotspots: [
          { a: "X006", box: [74.4, 14.3, 11.5, 23.2] },
          { a: "X006", box: [72.3, 86.5, 26.0, 9.0] }
        ]}
      ]}
    ]
  }
};
if (typeof window !== "undefined") window.PP_SCENE_PAGES = PP_SCENE_PAGES;
if (typeof module !== "undefined") module.exports = { PP_SCENE_PAGES: PP_SCENE_PAGES };
