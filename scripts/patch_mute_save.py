# -*- coding: utf-8 -*-
# Mute UX + old-save TU migration. (audio.js already patched: musicMuted not persisted.)
import io, re

p = "js/ui.js"; s = io.open(p, encoding="utf-8").read()

# ---- mute button: clear icons, toast feedback, syncs with a Settings checkbox ----
m = re.search(r'    var muteB = \$\("#music-mute"\);\n(?:.*\n)*?    muteIcon\(\);\n', s)
assert m, "muteB block"
new_mute = (
    '    var muteB = $("#music-mute");\n'
    '    function muteIcon() {\n'
    '      muteB.textContent = A.state.musicMuted ? "\\ud83d\\udd07" : "\\ud83d\\udd0a";\n'
    '      muteB.classList.toggle("muted", !!A.state.musicMuted);\n'
    '      var sm = $("#set-musicmute");\n'
    '      if (sm) sm.checked = !!A.state.musicMuted;\n'
    '    }\n'
    '    window.PPMuteIcon = muteIcon;\n'
    '    muteB.onclick = function () {\n'
    '      click();\n'
    '      A.set("musicMuted", !A.state.musicMuted);\n'
    '      muteIcon();\n'
    '      toast(A.state.musicMuted ? "\\ud83d\\udd07 Music muted (this session only)" : "\\ud83d\\udd0a Music on", "good");\n'
    '    };\n'
    '    muteIcon();\n'
)
s = s.replace(m.group(0), new_mute)

old = '    $("#set-mute").onchange = function () { A.set("muted", this.checked); };'
assert old in s, "settings mute"
s = s.replace(old, old +
    '\n    $("#set-musicmute").onchange = function () {\n'
    '      A.set("musicMuted", this.checked);\n'
    '      if (window.PPMuteIcon) window.PPMuteIcon();\n'
    '    };')

# ---- old saves (6-TU era): convert leftover TU to the 40-TU day on load ----
old = ('  function loadSave() {\n'
       '    try { return JSON.parse(window.PPStore.get("pp_save") || "null"); } catch (e) { return null; }\n'
       '  }')
assert old in s, "loadSave"
new = ('  function loadSave() {\n'
       '    try {\n'
       '      var s = JSON.parse(window.PPStore.get("pp_save") || "null");\n'
       '      // saves from before the 40-TU day: convert leftover TU to the new scale\n'
       '      if (s && s.state) {\n'
       '        var cur = DATA.settings.timeUnitsPerTurn;\n'
       '        var was = s.tuPerTurn || 6;\n'
       '        if (was !== cur) {\n'
       '          var f = cur / was;\n'
       '          s.state.players.forEach(function (p) {\n'
       '            p.tu = Math.round(p.tu * f);\n'
       '            p.tuPenaltyNext = Math.round((p.tuPenaltyNext || 0) * f);\n'
       '          });\n'
       '          s.tuPerTurn = cur;\n'
       '        }\n'
       '      }\n'
       '      return s;\n'
       '    } catch (e) { return null; }\n'
       '  }')
s = s.replace(old, new)

old = '      window.PPStore.set("pp_save", JSON.stringify({ state: UI.state, cfg: UI.cfg, mode: UI.mode }));'
assert old in s, "saveGame"
s = s.replace(old,
    '      window.PPStore.set("pp_save", JSON.stringify({ state: UI.state, cfg: UI.cfg, mode: UI.mode,\n'
    '        tuPerTurn: DATA.settings.timeUnitsPerTurn }));')
io.open(p, "w", encoding="utf-8", newline="\n").write(s)

# ---- Settings row ----
p = "index.html"; s = io.open(p, encoding="utf-8").read()
old = '        <div class="opt-row"><label>Mute All</label><input type="checkbox" id="set-mute"></div>'
assert old in s, "settings row"
s = s.replace(old,
    '        <div class="opt-row"><label>Mute Music Only</label><input type="checkbox" id="set-musicmute"></div>\n' + old)
io.open(p, "w", encoding="utf-8", newline="\n").write(s)

# ---- muted button styling ----
p = "css/style.css"; s = io.open(p, encoding="utf-8").read()
if "#music-mute.muted" not in s:
    s += "\n#music-mute.muted { filter: grayscale(1) brightness(.75); box-shadow: inset 0 0 0 99em rgba(180,40,40,.28); }\n"
io.open(p, "w", encoding="utf-8", newline="\n").write(s)
print("mute + save migration applied")
