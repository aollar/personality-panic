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
    tabBar: [
      { tab: "adopt",  box: [79.4, 5.4, 6.4, 4.4] },
      { tab: "care",   box: [86.1, 5.4, 6.6, 4.4] },
      { tab: "bribes", box: [93.0, 5.4, 6.0, 4.4] }
    ],
    arrows: { prev: [81.4, 58.8, 5.0, 5.6], next: [88.6, 58.8, 5.0, 5.6] }, // on the ◀ ▶ glyphs
    work: { a: "A110", box: [86.5, 89.0, 12.5, 10.0] },
    tabs: [
      { id: "adopt", label: "ADOPT", pages: [
        { img: "pet_adopt_1.jpg", hotspots: [
          { a: "A102", choice: { pet: "ESFJ" }, label: "Captain Snuggleton", box: [79.9, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ENFJ" }, label: "King Heartmane",     box: [89.0, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ENFP" }, label: "Otter the Explorer", box: [79.9, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ESFP" }, label: "Party Piggy",        box: [89.0, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ESFJ" }, label: "Captain Snuggleton", box: [79.9, 63.5, 18.0, 21.5] } // featured
        ]},
        { img: "pet_adopt_2.jpg", hotspots: [
          { a: "A102", choice: { pet: "ESTJ" }, label: "Chief Pawton",       box: [79.9, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ENTJ" }, label: "CEO Gorillionaire",  box: [89.0, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ENTP" }, label: "Sir Honksworth",     box: [79.9, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ESTP" }, label: "Hustle Harry",       box: [89.0, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ESTJ" }, label: "Chief Pawton",       box: [79.9, 63.5, 18.0, 21.5] }
        ]},
        { img: "pet_adopt_3.jpg", hotspots: [
          { a: "A102", choice: { pet: "ISFJ" }, label: "Nurse Nibbles",           box: [79.9, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "INFJ" }, label: "Vinnie the Vibe Scanner", box: [89.0, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "INFP" }, label: "Fawnie Dreamer",          box: [79.9, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ISFP" }, label: "Duchess Meowtilda",       box: [89.0, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ISFJ" }, label: "Nurse Nibbles",           box: [79.9, 63.5, 18.0, 21.5] }
        ]},
        { img: "pet_adopt_4.jpg", hotspots: [
          { a: "A102", choice: { pet: "ISTJ" }, label: "Detective Biscuit",  box: [79.9, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ISTP" }, label: "Clutch",             box: [89.0, 13.4, 8.9, 21.4] },
          { a: "A102", choice: { pet: "INTJ" }, label: "Professor Beakman",  box: [79.9, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "INTP" }, label: "Orylle Overplan",    box: [89.0, 35.0, 8.9, 21.4] },
          { a: "A102", choice: { pet: "ISTJ" }, label: "Detective Biscuit",  box: [79.9, 63.5, 18.0, 21.5] }
        ]}
      ]},
      { id: "care", label: "PET CARE", pages: [
        { img: "pet_care.jpg", hotspots: [
          { a: "A103", box: [79.9, 13.4, 8.9, 21.4] }, // Buy Pet Food
          { a: "A104", box: [89.0, 13.4, 8.9, 21.4] }, // Buy Pet Toy
          { a: "A105", box: [79.9, 35.0, 8.9, 21.4] }, // Feed Animals
          { a: "A106", box: [89.0, 35.0, 8.9, 21.4] }, // Bathe Animals
          { a: "A107", box: [79.9, 61.0, 18.0, 22.0] } // Play With Pet (wide)
        ]}
      ]},
      { id: "bribes", label: "BRIBES", pages: [
        { img: "pet_bribes.jpg", hotspots: [
          { a: "A108", box: [79.9, 13.4, 8.9, 21.4] }, // Bribe Inspector
          { a: "A109", box: [89.0, 13.4, 8.9, 21.4] }, // Contact P.I.T.A.
          { a: "A108", box: [79.9, 63.5, 18.0, 21.5] } // featured: Bribe Inspector
        ]}
      ]}
    ]
  },

  mall: {
    tabBar: MALL_TABS,
    work: { a: "A118", box: [81.0, 85.3, 17.7, 11.2] }, // full painted WORK button
    tabs: [
      { id: "style", label: "STYLE", pages: [
        { img: "mall.jpg", arrows: ARR_M3, hotspots: ppItemGrid([
          ["Casual Clothes", "A115"], ["Smart Clothes", "A115"], ["Business Clothes", "A115"],
          ["Dressy Clothes", "A115"], ["Dress Shoes", "A115"], ["Sunglasses", "A115"]], MG3) },
        { img: "mall_style_2.jpg", arrows: ARR_M3, hotspots: ppItemGrid([
          ["Earrings", "A115"], ["Bracelet", "A115"], ["Rings", "A115"],
          ["High Heels", "A115"], ["Crocodile Sandals", "A115"], ["Durag", "A115"]], MG3) },
        { img: "mall_style_3.jpg", arrows: ARR_M3, hotspots: ppItemGrid([
          ["Watch", "A113"], ["Cap", "A115"]], MG3) }
      ]},
      { id: "gear", label: "GEAR", pages: [
        { img: "mall_gear_1.jpg", arrows: ARR_M2, hotspots: ppItemGrid([
          ["Bus Pass", "A112"], ["Bicycle", "A112"], ["Car", "A112"],
          ["Mobile Phone", "A113"], ["Computer", "A113"], ["Camera", "A113"]], MG2) },
        { img: "mall_gear_2.jpg", arrows: ARR_M3, hotspots: ppItemGrid([
          ["TV", "A113"], ["Blu-ray", "A113"], ["E-reader", "A113"], ["Stereo", "A113"]], MG3) }
      ]},
      { id: "home", label: "HOME", pages: [
        { img: "mall_home_1.jpg", arrows: ARR_M2, hotspots: ppItemGrid([
          ["Lumpy Bed", "A114"], ["Nice Bed", "A114"], ["Premium Bed", "A114"],
          ["Couch", "A114"], ["Bookshelf", "A114"], ["Plants", "A114"]], MG2) },
        { img: "mall_home_2.jpg", arrows: ARR_M2, hotspots: ppItemGrid([
          ["Desk", "A114"], ["Ergonomic Chair", "A114"], ["Pet Bed", "A114"],
          ["Pet Toys", "A114"], ["Dining Table", "A114"], ["Mirror", "A114"]], MG2) },
        { img: "mall_home_3.jpg", arrows: ARR_M2, hotspots: ppItemGrid([
          ["Fridge", "A113"], ["Stove", "A113"], ["Vacuum", "A113"],
          ["Cold Plunge", "A113"], ["Hot Tub", "A113"]], MG2) }
      ]}
    ]
  },

  lowCost: {
    tabBar: [
      { tab: "unit", box: [72.8, 7.8, 12.5, 5.2] },
      { tab: "rent", box: [85.5, 7.8, 12.5, 5.2] }
    ],
    tabs: [
      { id: "unit", label: "UNIT ACTIONS", pages: [
        { img: "house_unit.jpg", hotspots: ppActGrid(
          ["A001", "A002", "A003", "A004", "A005", "A006", "A007"], HG) }
      ]},
      { id: "rent", label: "PAY RENT", pages: [
        { img: "house_rent.jpg", hotspots: [
          { a: "X006", box: [74.4, 14.3, 11.5, 23.2] }, // Pay Low-Cost Rent card
          { a: "X006", box: [72.3, 86.5, 26.0, 9.0] }   // big PAY RENT bar (A008 was
                                                        // folded into X006 in assumptions)
        ]}
      ]}
    ]
  }
};
if (typeof window !== "undefined") window.PP_SCENE_PAGES = PP_SCENE_PAGES;
if (typeof module !== "undefined") module.exports = { PP_SCENE_PAGES: PP_SCENE_PAGES };
