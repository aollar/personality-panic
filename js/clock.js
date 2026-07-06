/* PPClock — the live "panic" turn clock (pure SVG, from the reference art via Fable's build).
 * Ring = the turn's Time Units:  dark red = TU already used (from 12 o'clock, CLOCKWISE),
 * light-red = the hovered action's cost (the NEXT segment).  Center number = live label.
 * Factory: PPClock.mount(container) -> { set, preview, label }.  (Mount once per screen.) */
(function () {
  "use strict";
  var SVG =
    '<svg class="pc-svg" viewBox="392 38 872 848" xmlns="http://www.w3.org/2000/svg">' +
    '<defs>' +
      '<pattern id="pcStripes" patternUnits="userSpaceOnUse" width="52" height="52" patternTransform="rotate(35)">' +
        '<rect width="52" height="52" fill="#f29487"/><rect x="0" width="15" height="52" fill="#f5a597"/>' +
      '</pattern>' +
      '<radialGradient id="pcFace" cx="50%" cy="42%" r="65%"><stop offset="0%" stop-color="#f7ebda"/><stop offset="78%" stop-color="#f5e8d6"/><stop offset="100%" stop-color="#efdfc9"/></radialGradient>' +
      '<linearGradient id="pcBell" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e3ad61"/><stop offset="62%" stop-color="#d9a156"/><stop offset="100%" stop-color="#c08a44"/></linearGradient>' +
      '<linearGradient id="pcKnob" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e7bd7d"/><stop offset="100%" stop-color="#c9974f"/></linearGradient>' +
    '</defs>' +
    // knob
    '<g stroke="#1c0f05" stroke-width="11" stroke-linejoin="round">' +
      '<rect x="801" y="150" width="54" height="74" rx="10" fill="#4d423a"/>' +
      '<rect x="762" y="88" width="132" height="64" rx="26" fill="url(#pcKnob)"/></g>' +
    '<rect x="782" y="99" width="92" height="18" rx="9" fill="#eed9ac" opacity=".9"/>' +
    // bell L
    '<g transform="translate(-9 3) rotate(-36 660 300)">' +
      '<circle cx="580" cy="102" r="27" fill="#dca55b" stroke="#1c0f05" stroke-width="11"/>' +
      '<g stroke="#1c0f05" stroke-width="11" stroke-linejoin="round" stroke-linecap="round">' +
        '<path d="M 580 256 L 580 344" stroke-width="42"/>' +
        '<path d="M 580 260 L 580 338" stroke="#5a4b3f" stroke-width="22"/>' +
        '<path d="M 462 244 C 458 158 512 108 580 108 C 648 108 700 158 698 244 Z" fill="url(#pcBell)"/>' +
        '<rect x="448" y="238" width="264" height="27" rx="13" fill="#cf9950"/></g>' +
      '<path d="M 486 216 C 486 150 526 118 576 114 C 516 106 472 146 470 220 Z" fill="#f2c987" opacity=".95"/>' +
      '<ellipse cx="527" cy="148" rx="32" ry="13" fill="#f6d59b" opacity=".85" transform="rotate(-26 527 148)"/></g>' +
    // bell R
    '<g transform="translate(9 3) rotate(36 996 300)">' +
      '<circle cx="1076" cy="102" r="27" fill="#dca55b" stroke="#1c0f05" stroke-width="11"/>' +
      '<g stroke="#1c0f05" stroke-width="11" stroke-linejoin="round" stroke-linecap="round">' +
        '<path d="M 1076 256 L 1076 344" stroke-width="42"/>' +
        '<path d="M 1076 260 L 1076 338" stroke="#5a4b3f" stroke-width="22"/>' +
        '<path d="M 958 244 C 954 158 1008 108 1076 108 C 1144 108 1196 158 1194 244 Z" fill="url(#pcBell)"/>' +
        '<rect x="944" y="238" width="264" height="27" rx="13" fill="#cf9950"/></g>' +
      '<path d="M 982 216 C 982 150 1022 118 1072 114 C 1012 106 968 146 966 220 Z" fill="#f2c987" opacity=".95"/>' +
      '<ellipse cx="1023" cy="148" rx="32" ry="13" fill="#f6d59b" opacity=".85" transform="rotate(-26 1023 148)"/></g>' +
    // feet
    '<g stroke-linecap="round">' +
      '<path d="M 656 768 L 618 834" stroke="#1c0f05" stroke-width="56"/>' +
      '<path d="M 1000 768 L 1038 834" stroke="#1c0f05" stroke-width="56"/>' +
      '<path d="M 654 772 L 622 828" stroke="#33200f" stroke-width="32"/>' +
      '<path d="M 1002 772 L 1034 828" stroke="#33200f" stroke-width="32"/></g>' +
    // body + live ring (squashed ~6% vertically to match the art ellipse)
    '<g transform="translate(828 529) scale(1 0.9398) translate(-828 -529)">' +
      '<circle cx="828" cy="529" r="332" fill="url(#pcFace)" stroke="#1c0f05" stroke-width="21"/>' +
      '<circle cx="828" cy="529" r="286" fill="none" stroke="#8a715c" stroke-width="6"/>' +
      '<circle class="pc-used" cx="828" cy="529" r="246" fill="none" stroke="#e62426" stroke-width="76" transform="rotate(-90 828 529)"/>' +
      '<circle class="pc-preview" cx="828" cy="529" r="246" fill="none" stroke="url(#pcStripes)" stroke-width="76" transform="rotate(-90 828 529)"/>' +
      '<circle cx="828" cy="529" r="207" fill="none" stroke="#241608" stroke-width="7"/></g>' +
    // quarter ticks
    '<g stroke="#241608" stroke-width="13" stroke-linecap="round">' +
      '<line x1="828" y1="331" x2="828" y2="364"/><line x1="1028" y1="529" x2="995" y2="529"/>' +
      '<line x1="828" y1="727" x2="828" y2="694"/><line x1="628" y1="529" x2="661" y2="529"/></g>' +
    // live number
    '<text class="pc-label" x="828" y="536" text-anchor="middle" dominant-baseline="central" ' +
      'font-family="\'Arial Rounded MT Bold\',\'Baloo 2\',\'Nunito\',\'Comic Sans MS\',sans-serif" ' +
      'font-weight="900" font-size="212" fill="#2a180b" stroke="#2a180b" stroke-width="12" ' +
      'stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill">6</text>' +
    '</svg>';

  var R = 246, C = 2 * Math.PI * R, CX = 828, CY = 529;

  function mount(container) {
    container.innerHTML = SVG;
    var used = container.querySelector(".pc-used");
    var preview = container.querySelector(".pc-preview");
    var label = container.querySelector(".pc-label");
    var st = { total: 6, used: 0, preview: 0 };

    function render() {
      var total = Math.max(1, st.total);
      var u = Math.max(0, Math.min(st.used, total));
      var p = Math.max(0, Math.min(st.preview, total - u));
      var uLen = (u / total) * C;
      used.setAttribute("stroke-dasharray", uLen + " " + (C - uLen));
      var pLen = (p / total) * C;
      preview.setAttribute("stroke-dasharray", pLen + " " + (C - pLen));
      preview.setAttribute("transform", "rotate(" + (-90 + (u / total) * 360) + " " + CX + " " + CY + ")");
    }
    function fitLabel(text) {
      var s = String(text);
      if (s === "∞") {                       // ∞ (unlimited) — bigger, bolder, nudged up to center
        label.setAttribute("font-size", 300);
        label.setAttribute("stroke-width", 16);
        label.setAttribute("dy", "-34");
        label.textContent = s; return;
      }
      label.setAttribute("dy", "0");
      var n = s.length;
      label.setAttribute("font-size", n <= 2 ? 212 : n === 3 ? 160 : 120);
      label.setAttribute("stroke-width", n <= 2 ? 12 : 8);
      label.textContent = s;
    }
    render();
    return {
      set: function (o) {
        if (o && typeof o.total === "number") st.total = o.total;
        if (o && typeof o.used === "number") st.used = o.used;
        st.preview = 0; render();
      },
      preview: function (a) { st.preview = a || 0; render(); },
      label: function (t) { fitLabel(t); }
    };
  }

  window.PPClock = { mount: mount };
})();
