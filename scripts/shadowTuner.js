// Live tuning panel for the level shadows. Only appears when the game is
// opened with ?shadows in the address (e.g. http://localhost:8000/?shadows).
// Changes apply instantly and are kept in this browser; "Copy settings"
// copies them as JSON to paste back into SHADOW_DEFAULTS.
const ShadowTuner = {
    init()
    {
        if (!/[?&]shadows\b/.test(location.search)) return

        try
        {
            let saved = JSON.parse(localStorage.getItem("shadowSettings"))
            if (saved) Object.assign(ShadowSettings, saved)
        }
        catch (e) {}

        // Scripts run in <head>, before <body> exists.
        if (document.body) this.build()
        else window.addEventListener("DOMContentLoaded", () => this.build())
    },

    save()
    {
        try { localStorage.setItem("shadowSettings", JSON.stringify(ShadowSettings)) } catch (e) {}
        this.output.value = JSON.stringify(ShadowSettings, null, 4)
    },

    build()
    {
        let style = document.createElement("style")
        style.textContent = `
            #shadow-tuner {
                position: fixed; top: 8px; left: 8px; z-index: 1000; width: 250px;
                background: rgba(16, 16, 24, 0.94); color: #eee; border: 2px solid #fff;
                font: 12px/1.4 system-ui, sans-serif; padding: 10px; box-sizing: border-box;
                max-height: calc(100vh - 16px); overflow-y: auto;
            }
            #shadow-tuner h3 { margin: 0 0 8px; font-size: 13px; display: flex; justify-content: space-between; }
            #shadow-tuner label { display: flex; align-items: center; gap: 6px; margin: 4px 0; }
            #shadow-tuner .row { display: grid; grid-template-columns: 70px 1fr 38px; align-items: center; gap: 6px; margin: 5px 0; }
            #shadow-tuner input[type=range] { width: 100%; }
            #shadow-tuner .group { border-top: 1px solid #555; margin-top: 8px; padding-top: 6px; }
            #shadow-tuner button, #shadow-tuner select { font: inherit; }
            #shadow-tuner textarea { width: 100%; height: 120px; box-sizing: border-box; font: 11px monospace; margin-top: 6px; }
            #shadow-tuner.collapsed > :not(h3) { display: none; }
        `
        document.head.appendChild(style)

        let panel = document.createElement("div")
        panel.id = "shadow-tuner"
        panel.innerHTML = `
            <h3>Shadow tuner <button data-act="collapse">hide</button></h3>
            <label><input type="checkbox" data-key="enabled"> Shadows on</label>
            <div class="row"><span>Offset X</span><input type="range" min="-8" max="8" step="1" data-key="offsetX"><span data-out="offsetX"></span></div>
            <div class="row"><span>Offset Y</span><input type="range" min="-8" max="8" step="1" data-key="offsetY"><span data-out="offsetY"></span></div>
            <div class="row"><span>Opacity</span><input type="range" min="0" max="1" step="0.05" data-key="opacity"><span data-out="opacity"></span></div>
            <div class="row"><span>Color</span><input type="color" data-key="color"><span></span></div>
            <div class="group">Casts a shadow:
                <label><input type="checkbox" data-key="terrain"> Terrain tiles</label>
                <label><input type="checkbox" data-key="foregroundTiles"> Foreground tiles</label>
                <label><input type="checkbox" data-key="backgroundTiles"> Background decoration tiles</label>
                <label><input type="checkbox" data-key="characters"> Frodo &amp; friends</label>
                <label><input type="checkbox" data-key="enemies"> Enemies &amp; bosses</label>
                <label><input type="checkbox" data-key="items"> Items (coins, spikes, springs...)</label>
                <label><input type="checkbox" data-key="projectiles"> Projectiles</label>
                <label><input type="checkbox" data-key="other"> Everything else</label>
            </div>
            <div class="group">
                <div class="row" style="grid-template-columns: 1fr auto">
                    <select data-act="level"></select><button data-act="go">Go</button>
                </div>
            </div>
            <div class="group">
                <button data-act="copy">Copy settings</button>
                <button data-act="reset">Reset</button>
                <textarea readonly></textarea>
            </div>
        `
        document.body.appendChild(panel)
        this.output = panel.querySelector("textarea")

        // Inputs <-> settings.
        let refresh = () =>
        {
            panel.querySelectorAll("[data-key]").forEach(input =>
            {
                let key = input.dataset.key
                if (input.type == "checkbox") input.checked = ShadowSettings[key]
                else input.value = ShadowSettings[key]
            })
            panel.querySelectorAll("[data-out]").forEach(out => out.textContent = ShadowSettings[out.dataset.out])
            this.save()
        }

        panel.querySelectorAll("[data-key]").forEach(input =>
        {
            input.addEventListener("input", () =>
            {
                let key = input.dataset.key
                if (input.type == "checkbox") ShadowSettings[key] = input.checked
                else if (input.type == "range") ShadowSettings[key] = Number(input.value)
                else ShadowSettings[key] = input.value
                refresh()
            })
            // Give the keyboard back to the game after using a control.
            input.addEventListener("change", () => input.blur())
        })

        // Level picker (the Balrog fight has no tiles, so it's left out).
        let select = panel.querySelector("[data-act=level]")
        LEVEL_SELECT.filter(entry => !entry.scene).forEach(entry =>
        {
            let option = document.createElement("option")
            option.value = entry.level
            option.textContent = entry.title + " " + entry.act.replace("WORLD ", "").replace(" - ACT ", "-")
            select.appendChild(option)
        })

        panel.addEventListener("click", (e) =>
        {
            let act = e.target.dataset && e.target.dataset.act
            if (act == "collapse")
            {
                panel.classList.toggle("collapsed")
                e.target.textContent = panel.classList.contains("collapsed") ? "show" : "hide"
            }
            else if (act == "go")
            {
                currentLevel = Number(select.value)
                game.sound.stopAll()
                let active = game.scene.getScenes(true)
                active.forEach(scene => { if (scene.scene.key != "Level") scene.scene.stop() })
                let level = game.scene.getScene("Level")
                if (level.sys.isActive() || level.sys.isPaused()) level.scene.restart()
                else game.scene.start("Level")
                Hints.hide()
            }
            else if (act == "copy")
            {
                this.output.select()
                let text = this.output.value
                if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => document.execCommand("copy"))
                else document.execCommand("copy")
                e.target.textContent = "Copied!"
                setTimeout(() => e.target.textContent = "Copy settings", 1200)
            }
            else if (act == "reset")
            {
                Object.assign(ShadowSettings, SHADOW_DEFAULTS)
                refresh()
            }
            if (e.target.tagName == "BUTTON") e.target.blur()
        })

        refresh()
    }
}
