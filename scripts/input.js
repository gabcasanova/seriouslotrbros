// Shared input for keyboard and Xbox (standard layout) controllers.
// The active device switches to whatever was used last, and the on-screen
// control hints follow it.

const STICK_DEADZONE = 0.4

// Standard gamepad button indices.
const PAD = {A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15}

const BINDINGS = {
    left:     {keys: ["ArrowLeft"],  buttons: [PAD.LEFT],  axis: [0, -1]},
    right:    {keys: ["ArrowRight"], buttons: [PAD.RIGHT], axis: [0, 1]},
    up:       {keys: ["ArrowUp"],    buttons: [PAD.UP],    axis: [1, -1]},
    down:     {keys: ["ArrowDown"],  buttons: [PAD.DOWN],  axis: [1, 1]},
    jump:     {keys: ["KeyA", "Space"], buttons: [PAD.A]},
    attack:   {keys: ["KeyS"], buttons: [PAD.X, PAD.B]},
    confirm:  {keys: ["Enter", "Space", "KeyA"], buttons: [PAD.A, PAD.START]},
    skip:     {keys: ["Enter", "Space", "Escape", "KeyA", "KeyS"], buttons: [PAD.A, PAD.B, PAD.START]},
    strike:   {keys: ["KeyS", "Space"], buttons: [PAD.A, PAD.X]},
    panLeft:  {keys: ["KeyA"], buttons: [PAD.LB]},
    panRight: {keys: ["KeyD"], buttons: [PAD.RB]},
    pause:    {keys: ["Escape", "KeyP", "Enter"], buttons: [PAD.START]},
    cancel:   {keys: ["Escape", "Backspace"], buttons: [PAD.B]}
}

// Every key the game uses, so the browser doesn't scroll or click with them.
const GAME_KEYS = new Set([].concat(...Object.values(BINDINGS).map(b => b.keys)))

const GameInput = {
    mode: "keyboard",
    keysDown: new Set(),
    keysPressed: new Set(),
    padDown: [],
    padPressed: new Set(),
    axes: [0, 0],
    listeners: [],

    init(game)
    {
        window.addEventListener("keydown", (e) =>
        {
            if (GAME_KEYS.has(e.code)) e.preventDefault()
            if (!e.repeat) this.keysPressed.add(e.code)
            this.keysDown.add(e.code)
            this.setMode("keyboard")
        })
        window.addEventListener("keyup", (e) => this.keysDown.delete(e.code))
        window.addEventListener("blur", () => this.keysDown.clear())
        window.addEventListener("pointerdown", () => this.setMode("keyboard"))

        game.events.on(Phaser.Core.Events.PRE_STEP, () => this.pollPad())
        game.events.on(Phaser.Core.Events.POST_RENDER, () =>
        {
            this.keysPressed.clear()
            this.padPressed.clear()
        })
    },

    pollPad()
    {
        let pads = navigator.getGamepads ? navigator.getGamepads() : []
        let pad = null
        for (let p of pads)
        {
            if (p && p.connected) { pad = p; break }
        }

        if (!pad)
        {
            this.padDown = []
            this.axes = [0, 0]
            return
        }

        let used = false
        let down = pad.buttons.map(b => b.pressed || b.value > 0.5)
        down.forEach((d, i) =>
        {
            if (d && !this.padDown[i]) { this.padPressed.add(i); used = true }
        })
        this.padDown = down

        let axes = [pad.axes[0] || 0, pad.axes[1] || 0]
            .map(a => Math.abs(a) > STICK_DEADZONE ? a : 0)

        // Treat a fresh stick push like a button press (for menus).
        axes.forEach((a, i) =>
        {
            let was = Math.sign(this.axes[i])
            let now = Math.sign(a)
            if (now != 0 && now != was)
            {
                this.padPressed.add("axis" + i + (now > 0 ? "+" : "-"))
                used = true
            }
        })
        this.axes = axes

        if (used) this.setMode("gamepad")
    },

    setMode(mode)
    {
        if (this.mode == mode) return
        this.mode = mode
        this.listeners.forEach(fn => fn(mode))
    },

    onModeChange(fn)
    {
        this.listeners.push(fn)
    },

    offModeChange(fn)
    {
        this.listeners = this.listeners.filter(l => l != fn)
    },

    isDown(action)
    {
        let b = BINDINGS[action]
        if (b.keys.some(k => this.keysDown.has(k))) return true
        if (b.buttons.some(i => this.padDown[i])) return true
        if (b.axis && Math.sign(this.axes[b.axis[0]]) == b.axis[1]) return true
        return false
    },

    justPressed(action)
    {
        let b = BINDINGS[action]
        if (b.keys.some(k => this.keysPressed.has(k))) return true
        if (b.buttons.some(i => this.padPressed.has(i))) return true
        if (b.axis && this.padPressed.has("axis" + b.axis[0] + (b.axis[1] > 0 ? "+" : "-"))) return true
        return false
    },

    // Analog left stick (falls back to d-pad/arrows), each axis in -1..1.
    stick()
    {
        let x = this.axes[0]
        let y = this.axes[1]
        if (x == 0) x = (this.isDown("right") ? 1 : 0) - (this.isDown("left") ? 1 : 0)
        if (y == 0) y = (this.isDown("down") ? 1 : 0) - (this.isDown("up") ? 1 : 0)
        return {x, y}
    }
}
