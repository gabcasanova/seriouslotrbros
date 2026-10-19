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

        game.events.on(Phaser.Core.Events.POST_RENDER, () => this.fit())
        window.addEventListener("resize", () => this.fit())
        this.fit()
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
        this.root.style.setProperty("--clip-bottom", Math.max(0, r.bottom - window.innerHeight) + "px")
    }
}

// Glyphs per device. Gamepad glyphs follow the Xbox layout.
const HINT_GLYPHS = {
    keyboard: {
        move: ["left", "right"], navigate: ["up", "down"], aim: ["arrows"], pan: ["A", "D"],
        jump: ["A"], attack: ["S"], confirm: ["ENTER"], skip: ["ENTER"], strike: ["S"], back: ["left"]
    },
    gamepad: {
        move: ["dpad"], navigate: ["dpad"], aim: ["LS"], pan: ["LB", "RB"],
        jump: ["A"], attack: ["X"], confirm: ["A"], skip: ["A"], strike: ["A"], back: ["dpad"]
    }
}

const Hints = {
    current: [],

    // list: [{action: "jump", label: "JUMP"}, ...]. Empty hides the hints.
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
        let el = Overlay.hints
        if (!el) return

        let glyphs = HINT_GLYPHS[GameInput.mode]
        el.innerHTML = ""
        for (let hint of this.current)
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

        if (GameInput.mode == "gamepad")
        {
            if (["A", "B", "X", "Y"].includes(name))
            {
                span.className = "pad-face pad-" + name
                span.textContent = name
            }
            else if (name == "dpad")
            {
                span.className = "pad-dpad"
                span.innerHTML = "<i></i><i></i>"
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

GameInput.onModeChange(() => Hints.render())

// Plays a cutscene video in the HTML layer at full resolution.
// The element is owned by the scene and torn down with it, so nothing
// can keep playing in the background.
class Cutscene
{
    constructor(scene, src, onEnd)
    {
        this.scene = scene
        this.onEnd = onEnd
        this.finished = false

        let video = document.createElement("video")
        video.className = "cutscene"
        video.src = src
        video.playsInline = true
        video.preload = "auto"
        video.addEventListener("ended", () => this.finish())
        video.addEventListener("error", () => this.finish())
        Overlay.root.insertBefore(video, Overlay.hints)
        this.video = video

        // Retry with sound on the next real interaction if autoplay was blocked.
        this.unlock = () =>
        {
            if (this.video && this.video.muted)
            {
                this.video.muted = false
            }
        }

        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy())
    }

    play()
    {
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
