// Music and sound effect on/off switches, remembered between sessions.
// Every sound is muted or not by its key when created, so no scene code
// has to know about the settings.

// Sound keys that count as music; everything else is a sound effect.
const MUSIC_KEYS = new Set([
    "menu", "levelMusic", "bossMusic", "fanfare", "actClear", "balrogMusic", "creditsMusic"
])

const AudioSettings = {
    music: true,
    sfx: true,
    listeners: [],

    init(game)
    {
        try
        {
            let saved = JSON.parse(localStorage.getItem("audioSettings"))
            if (saved)
            {
                this.music = saved.music !== false
                this.sfx = saved.sfx !== false
            }
        }
        catch (e) {}

        // Mute new sounds that are switched off. It has to be in the sound's
        // config: Phaser re-applies the config every time a sound plays.
        let sound = game.sound
        let add = sound.add.bind(sound)
        sound.add = (key, config) => add(key, Object.assign({}, config, {mute: !this.isOn(key)}))
    },

    isMusic(key)
    {
        return MUSIC_KEYS.has(key)
    },

    isOn(key)
    {
        return this.isMusic(key) ? this.music : this.sfx
    },

    // kind: "music" or "sfx".
    toggle(kind)
    {
        this[kind] = !this[kind]

        try
        {
            localStorage.setItem("audioSettings", JSON.stringify({music: this.music, sfx: this.sfx}))
        }
        catch (e) {}

        game.sound.sounds.forEach(s =>
        {
            let mute = !this.isOn(s.key)
            s.config.mute = mute
            s.setMute(mute)
        })
        this.listeners.forEach(fn => fn())
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
