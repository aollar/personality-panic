/*
 * PERSONALITY PANIC — overmap walking avatar.
 * Ported from the campaigner-board walker: feet-anchored sprite, road-graph
 * polyline routes, constant-speed rAF motion, facing flips, idle/walk APNG swap.
 */
(function () {
  var E = window.PPEngine;
  var AR_X = 1672 / 100, AR_Y = 941 / 100;
  var WALK_SPEED = 560; // native map px per second
  var IDLE_SRC = "assets/avatar/campaigner-idle.png";
  var WALK_SRC = "assets/avatar/campaigner-walk.png";

  function Walker(container) {
    var el = document.createElement("div");
    el.className = "avatar";
    el.innerHTML = '<div class="ring"></div><div class="flip"><img alt="player token"></div>';
    container.appendChild(el);
    this.el = el;
    this.flip = el.querySelector(".flip");
    this.img = el.querySelector("img");
    this.ring = el.querySelector(".ring");
    this.img.src = IDLE_SRC;
    this.pos = (E.NODE_POS.lowCost || [47.3, 74.0]).slice(); // lowCost doorstep
    this.raf = null;
    this.setPos(this.pos[0], this.pos[1]);
  }
  Walker.prototype.setPos = function (x, y) {
    this.pos = [x, y];
    this.el.style.left = x + "%";
    this.el.style.top = y + "%";
  };
  Walker.prototype.setName = function (name, color) {
    this.ring.textContent = name;
    if (color) this.ring.style.background = color;
  };
  Walker.prototype.jumpTo = function (buildingId) {
    var p = E.NODE_POS[buildingId];
    if (p) this.setPos(p[0], p[1]);
  };
  function segLen(a, b) {
    return Math.hypot((a[0] - b[0]) * AR_X, (a[1] - b[1]) * AR_Y);
  }
  // route: engine path {nodes:[ids]} between buildings -> pixel polyline walk
  Walker.prototype.walkTo = function (buildingId, fromId, onArrive) {
    var self = this;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
    var nodes = (fromId && E.PATHS[fromId + "|" + buildingId])
      ? E.PATHS[fromId + "|" + buildingId].nodes.slice() : [buildingId];
    var pts = nodes.map(function (n) { return E.NODE_POS[n].slice(); });
    if (segLen(this.pos, pts[0]) > 3) pts.unshift(this.pos.slice());

    var segs = [], total = 0;
    for (var i = 1; i < pts.length; i++) { var L = segLen(pts[i - 1], pts[i]); segs.push(L); total += L; }
    if (total < 0.5 || pts.length < 2) {
      this.setPos(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      if (onArrive) onArrive(); return;
    }
    var duration = Math.max(450, (total / WALK_SPEED) * 1000);
    // arrive exactly ONCE no matter what finishes first. rAF stalls in hidden
    // tabs (this froze CPU turns mid-walk): hidden = skip the animation, and a
    // watchdog guarantees arrival even if rAF stops halfway through.
    var arrived = false;
    var done = function () {
      if (arrived) return;
      arrived = true;
      if (self.raf) { cancelAnimationFrame(self.raf); self.raf = null; }
      if (self.watchdog) { clearTimeout(self.watchdog); self.watchdog = null; }
      self.img.src = IDLE_SRC;
      self.setPos(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      if (onArrive) onArrive();
    };
    if (this.watchdog) clearTimeout(this.watchdog);
    if (document.hidden) { done(); return; }
    this.watchdog = setTimeout(done, duration + 1200);
    var t0 = performance.now();
    this.img.src = WALK_SRC;
    function frame(now) {
      if (arrived) return;
      var p = Math.min(1, (now - t0) / duration);
      var target = p * total, acc = 0, i = 0;
      while (i < segs.length - 1 && acc + segs[i] < target) { acc += segs[i]; i++; }
      var a = pts[i], b = pts[i + 1];
      var f = segs[i] ? Math.min(1, (target - acc) / segs[i]) : 1;
      var x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
      if (b[0] - a[0] < -0.05) self.flip.classList.add("face-left");
      else if (b[0] - a[0] > 0.05) self.flip.classList.remove("face-left");
      self.setPos(x, y);
      if (p < 1) { self.raf = requestAnimationFrame(frame); }
      else done();
    }
    this.raf = requestAnimationFrame(frame);
  };
  window.PPWalker = Walker;
})();
