// Master volume, 0-100 in steps of 10, remembered between sessions. It
// covers everything: music, sound effects and cutscene videos.
const VOLUME_STEP = 10

const AudioSettings = {
    volume: 100,
    listeners: [],

    init(game)
    {
        try
        {
            let saved = localStorage.getItem("audioVolume")
            if (saved !== null) this.volume = Phaser.Math.Clamp(Number(saved) || 0, 0, 100)
        }
        catch (e) {}
        game.sound.volume = this.volume / 100
    },

    set(volume)
    {
        this.volume = Phaser.Math.Clamp(Math.round(volume / VOLUME_STEP) * VOLUME_STEP, 0, 100)
        try { localStorage.setItem("audioVolume", String(this.volume)) } catch (e) {}
        game.sound.volume = this.volume / 100
        this.listeners.forEach(fn => fn())
    },

    // One step up or down (dir: 1 or -1).
    step(dir)
    {
        this.set(this.volume + dir * VOLUME_STEP)
    },

    // One step up, back to 0 after 100 (for a single button).
    cycle()
    {
        this.set(this.volume >= 100 ? 0 : this.volume + VOLUME_STEP)
    },

    onChange(fn)
    {
        this.listeners.push(fn)
    },

    offChange(fn)
    {
        this.listeners = this.listeners.filter(l => l != fn)
    }
}
