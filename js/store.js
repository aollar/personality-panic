/*
 * Safe storage wrapper. Some browsers (or privacy settings/extensions) block
 * localStorage on file:// pages and THROW on any access — which killed button
 * wiring mid-init. All game persistence goes through here; if storage is
 * blocked we fall back to in-memory (saves just don't survive a reload).
 */
var PPStore = (function () {
  var mem = {};
  var ok = false;
  try {
    var t = "__pp_probe__";
    window.localStorage.setItem(t, "1");
    window.localStorage.removeItem(t);
    ok = true;
  } catch (e) { ok = false; }
  return {
    available: ok,
    get: function (k) {
      if (ok) { try { return window.localStorage.getItem(k); } catch (e) {} }
      return (k in mem) ? mem[k] : null;
    },
    set: function (k, v) {
      if (ok) { try { window.localStorage.setItem(k, v); return; } catch (e) {} }
      mem[k] = String(v);
    },
    remove: function (k) {
      if (ok) { try { window.localStorage.removeItem(k); } catch (e) {} }
      delete mem[k];
    }
  };
})();
if (typeof window !== "undefined") window.PPStore = PPStore;
