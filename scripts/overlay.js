// HTML layer kept on top of the game canvas. Used for things that look
// better at the screen's real resolution than at the game's 430x240:
// cutscene videos and the control hints.

const Overlay = {
    root: null,
    canvas: null,
    lastRect: "",

    init(game)
    {
        this.canvas = game.canvas
        this.root = document.createElement("div")
        this.root.id = "overlay"
        document.body.appendChild(this.root)

        this.hints = document.createElement("div")
        this.hints.id = "hints"
        this.root.appendChild(this.hints)

        this.hintsTop = document.createElement("div")
        this.hintsTop.id = "hints-top"
        this.root.appendChild(this.hintsTop)

        game.events.on(Phaser.Core.Events.POST_RENDER, () => this.fit())
        window.addEventListener("resize", () => this.fit())
        this.fit()
    },

    // Part of the game (in game pixels) that's inside the window; the
    // canvas is cropped at the sides when the window is narrow.
    visibleBounds()
    {
        let r = this.canvas.getBoundingClientRect()
        let px = r.width / config.width
        return {
            left: Math.max(0, -r.left) / px,
            right: config.width - Math.max(0, r.right - window.innerWidth) / px
        }
    },

    // Match the canvas' on-screen box.
    fit()
    {
        let r = this.canvas.getBoundingClientRect()
        let key = r.left + "," + r.top + "," + r.width + "," + r.height + "," + window.innerWidth + "," + window.innerHeight
        if (key == this.lastRect) return
        this.lastRect = key

        Object.assign(this.root.style, {
            left: r.left + "px",
            top: r.top + "px",
            width: r.width + "px",
            height: r.height + "px"
        })
        // One game pixel in screen pixels.
        this.root.style.setProperty("--px", (r.height / config.height) + "px")
        // Same, rounded down to whole screen pixels, for crisp pixel art.
        this.root.style.setProperty("--hp", Math.max(1, Math.floor(r.height / config.height)) + "px")

        // The canvas can be wider than the window (it's cropped then), so
        // keep the hints inside the part that's actually visible.
        this.root.style.setProperty("--clip-right", Math.max(0, r.right - window.innerWidth) + "px")
        this.root.style.setProperty("--clip-left", Math.max(0, -r.left) + "px")
        this.root.style.setProperty("--clip-bottom", Math.max(0, r.bottom - window.innerHeight) + "px")
    }
}

// Glyphs per device. Gamepad glyphs follow the Xbox layout.
const HINT_GLYPHS = {
    keyboard: {
        move: ["left", "right"], navigate: ["up", "down"], aim: ["arrows"], pan: ["A", "D"],
        jump: ["A"], attack: ["S"], confirm: ["ENTER"], skip: ["ENTER"], strike: ["S"], back: ["left"],
        pause: ["ENTER"], cancel: ["ESC"], choose: ["left", "right"], super: ["D"], spindash: ["down", "plus", "A"]
    },
    gamepad: {
        move: ["dpad"], navigate: ["dpad"], aim: ["LS"], pan: ["LB", "RB"],
        jump: ["A"], attack: ["X"], confirm: ["A"], skip: ["A"], strike: ["A"], back: ["dpad"],
        pause: ["START"], cancel: ["B"], choose: ["dpad"], super: ["B"], spindash: ["dpad-down", "plus", "A"]
    }
}

const Hints = {
    current: [],

    // list: [{action: "jump", label: "JUMP"}, ...]. Empty hides the hints.
    // Entries with top: true go in the top-right corner instead.
    show(list)
    {
        this.current = list || []
        this.render()
    },

    hide()
    {
        this.show([])
    },

    render()
    {
        if (!Overlay.hints) return
        this.fill(Overlay.hints, this.current.filter(h => !h.top))
        this.fill(Overlay.hintsTop, this.current.filter(h => h.top))
    },

    fill(el, list)
    {
        let glyphs = HINT_GLYPHS[GameInput.mode]
        el.innerHTML = ""
        for (let hint of list)
        {
            let row = document.createElement("div")
            row.className = "hint"

            for (let g of glyphs[hint.action])
            {
                row.appendChild(this.glyph(g))
            }

            let label = document.createElement("span")
            label.className = "hint-label"
            label.textContent = hint.label
            row.appendChild(label)

            el.appendChild(row)
        }
    },

    glyph(name)
    {
        let span = document.createElement("span")

        if (name == "plus")
        {
            span.className = "hint-plus"
            span.textContent = "+"
            return span
        }

        if (name == "mouse")
        {
            span.className = "mouse"
            span.appendChild(this.pixelIcon(MOUSE_ICON))
        }
        else if (GameInput.mode == "gamepad")
        {
            if (["A", "B", "X", "Y"].includes(name))
            {
                span.className = "pad-face pad-" + name
                span.textContent = name
            }
            else if (name == "dpad" || name == "dpad-down")
            {
                // "dpad-down": the d-pad with its down arm lit up.
                span.className = "pad-dpad" + (name == "dpad-down" ? " pad-dpad-down" : "")
                span.innerHTML = "<i></i><i></i>" + (name == "dpad-down" ? "<b></b>" : "")
            }
            else
            {
                span.className = "pad-pill"
                span.textContent = name
            }
        }
        else
        {
            span.className = "key"
            if (name == "arrows")
            {
                ["left", "up", "down", "right"].forEach(dir => span.appendChild(this.arrow(dir)))
            }
            else if (ARROW_ROTATION[name] !== undefined)
            {
                span.appendChild(this.arrow(name))
            }
            else
            {
                span.textContent = name
            }
        }

        return span
    },

    // SVG from rows of pixels: "#" uses the text color, "r" red.
    pixelIcon(rows)
    {
        let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        let w = rows[0].length
        svg.setAttribute("viewBox", "0 0 " + w + " " + rows.length)
        svg.setAttribute("shape-rendering", "crispEdges")
        svg.style.width = "calc(var(--hp) * " + w + ")"
        svg.style.height = "calc(var(--hp) * " + rows.length + ")"
        let html = ""
        rows.forEach((row, y) => [...row].forEach((p, x) =>
        {
            if (p == "#") html += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="currentColor"/>'
            if (p == "r") html += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="#d82800"/>'
        }))
        svg.innerHTML = html
        return svg
    },

    // Pixel-art arrow, since the NES font has no arrow characters.
    arrow(dir)
    {
        let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        svg.setAttribute("viewBox", "0 0 7 7")
        svg.setAttribute("shape-rendering", "crispEdges")
        svg.setAttribute("class", "key-arrow")
        svg.innerHTML = '<path fill="currentColor" transform="rotate(' + ARROW_ROTATION[dir] + ' 3.5 3.5)" ' +
            'd="M3 0h1v1h1v1h1v1h1v1h-2v3h-3v-3h-2v-1h1v-1h1v-1h1z"/>'
        return svg
    }
}

const ARROW_ROTATION = {up: 0, right: 90, down: 180, left: 270}

// Mouse with the left button pressed ("#" white, "r" red).
const MOUSE_ICON = [
    ".##.##.",
    "#rr#..#",
    "#rr#..#",
    "#######",
    "#.....#",
    "#.....#",
    "#.....#",
    "#.....#",
    ".#...#.",
    "..###.."
]

GameInput.onModeChange(() => Hints.render())

// A card of text pages in the HTML layer, for crisp text with control icons
// inline. Each page is a function of the input mode returning paragraphs:
// [{color: "#fff", text: "Press {A} to jump"}], where {name} is a glyph.
// Clicking or confirming goes to the next page; onDone runs after the last.
class Briefing
{
    constructor(scene, pages, hintLabels, onDone)
    {
        this.scene = scene
        this.pages = pages
        this.hintLabels = hintLabels
        this.onDone = onDone
        this.index = 0

        // Same 8-bit window as the pause menu, drawn in the game itself.
        let w = 256
        let h = 160
        this.window = drawWindow(scene.add.graphics(), Math.round((config.width - w) / 2), Math.round((config.height - h) / 2), w, h)
            .setScrollFactor(0, 0)
            .setDepth(10)

        this.page = document.createElement("div")
        this.page.className = "briefing-page"
        Overlay.root.insertBefore(this.page, Overlay.hints)

        this.rerender = () => this.render()
        GameInput.onModeChange(this.rerender)
        window.addEventListener("resize", this.rerender)
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy())

        this.render()
    }

    next()
    {
        if (!this.page) return
        this.index++
        if (this.index < this.pages.length)
        {
            this.render()
        }
        else
        {
            this.destroy()
            this.onDone()
        }
    }

    render()
    {
        if (!this.page) return

        this.page.innerHTML = ""
        for (let paragraph of this.pages[this.index](GameInput.mode))
        {
            let p = document.createElement("p")
            p.style.color = paragraph.color
            if (paragraph.text.includes("{")) p.className = "has-glyph"
            paragraph.text.split(/(\{[^}]+\})/).forEach(part =>
            {
                if (part.startsWith("{"))
                {
                    p.appendChild(Hints.glyph(part.slice(1, -1)))
                }
                else if (part)
                {
                    p.appendChild(document.createTextNode(part))
                }
            })
            this.page.appendChild(p)
        }

        let last = this.index == this.pages.length - 1
        Hints.show([{action: "confirm", label: last ? this.hintLabels[1] : this.hintLabels[0]}])

        this.layout()
    }

    // Place everything on whole screen pixels so the font stays sharp.
    layout()
    {
        let r = Overlay.root.getBoundingClientRect()
        let px = r.height / config.height
        let hp = Math.max(1, Math.floor(px))
        let cx = Math.round(r.width / 2)
        let cy = Math.round(r.height / 2)

        this.page.style.width = (240 * hp) + "px"
        this.page.style.left = (cx - 120 * hp) + "px"
        this.page.style.top = (cy - Math.round(this.page.offsetHeight / 2 / hp) * hp) + "px"
    }

    destroy()
    {
        GameInput.offModeChange(this.rerender)
        window.removeEventListener("resize", this.rerender)
        if (this.page)
        {
            this.window.destroy()
            this.page.remove()
            this.page = null
        }
    }
}

// Plays a cutscene video in the HTML layer at full resolution.
// The element is owned by the scene and torn down with it, so nothing
// can keep playing in the background.
class Cutscene
{
    constructor(scene, src, onEnd, framed)
    {
        this.scene = scene
        this.onEnd = onEnd
        this.finished = false

        let video = document.createElement("video")
        video.className = "cutscene" + (framed ? " framed" : "")
        video.src = versioned(src)
        video.playsInline = true
        video.preload = "auto"
        video.addEventListener("ended", () => this.finish())
        video.addEventListener("error", () => this.finish())
        Overlay.root.insertBefore(video, Overlay.hints)
        this.video = video

        // Retry with sound on the next real interaction if autoplay was blocked.
        this.unlock = () =>
        {
            if (this.video && this.video.muted && AudioSettings.volume > 0)
            {
                this.video.muted = false
            }
        }

        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy())
    }

    play()
    {
        // Cutscenes follow the game's volume.
        this.video.volume = AudioSettings.volume / 100
        this.video.muted = AudioSettings.volume == 0
        let attempt = this.video.play()
        if (attempt)
        {
            attempt.catch(() =>
            {
                // Browser blocked autoplay with sound: play muted instead.
                if (!this.video) return
                this.video.muted = true
                this.video.play().catch(() => this.finish())
                window.addEventListener("pointerdown", this.unlock, {once: true})
                window.addEventListener("keydown", this.unlock, {once: true})
            })
        }
        return this
    }

    // NES-style stepped fade to black (and sound fade), then calls done.
    fadeOut(duration, done)
    {
        if (!this.video) return
        let video = this.video
        let steps = NES_FADE_STEPS
        duration /= FADE_SPEED
        let step = 0

        this.scene.tweens.add({targets: video, volume: 0, duration: duration})
        this.scene.time.addEvent({
            delay: duration / steps,
            repeat: steps - 1,
            callback: () =>
            {
                step++
                video.style.opacity = 1 - step / steps
                if (step == steps && done) done()
            }
        })
    }

    finish()
    {
        if (this.finished) return
        this.finished = true
        if (this.onEnd) this.onEnd()
    }

    destroy()
    {
        this.finished = true
        window.removeEventListener("pointerdown", this.unlock)
        window.removeEventListener("keydown", this.unlock)

        if (this.video)
        {
            this.video.pause()
            this.video.removeAttribute("src")
            this.video.load()
            this.video.remove()
            this.video = null
        }
    }
}
