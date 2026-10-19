// Pause menu, launched on top of a paused Level or Balrog scene.
class Pause extends Phaser.Scene
{
    constructor()
    {
        super({key: "Pause"})
    }

    // Pause the given scene and show this one over it.
    static open(scene)
    {
        // Online the game can't stop for everyone: just a menu over it, and
        // no restarting.
        if (scene.online || scene.netSession || Net.inGame)
        {
            scene.player.canMove = false
            scene.player.setVelocityX(0)
            scene.scene.launch("Pause", {target: scene.scene.key, hints: Hints.current, online: true})
            return
        }
        scene.sound.pauseAll()
        scene.scene.launch("Pause", {target: scene.scene.key, hints: Hints.current})
        scene.scene.pause()
    }

    init(data)
    {
        this.target = data.target
        this.previousHints = data.hints
        this.online = !!data.online
    }

    create()
    {
        this.leaving = false

        let w = 112
        let h = 88
        let x = Math.round((config.width - w) / 2)
        let y = Math.round((config.height - h) / 2)

        drawWindow(this.add.graphics(), x, y, w, h)
        addNesText(this, config.width / 2, y + 8, "PAUSE", "#ffffff", true)

        let onOff = (kind) => AudioSettings[kind] ? "ON" : "OFF"
        this.options = this.online ? [
            {label: () => "RESUME",     action: () => this.resume()},
            {label: () => "MUSIC: " + onOff("music"), action: () => this.toggle("music"), toggle: true},
            {label: () => "SFX: " + onOff("sfx"),     action: () => this.toggle("sfx"), toggle: true},
            {label: () => "LEAVE ROOM", action: () => this.leaveRoom()}
        ] : [
            {label: () => "RESUME",    action: () => this.resume()},
            {label: () => "RESTART",   action: () => this.restart()},
            {label: () => "MUSIC: " + onOff("music"), action: () => this.toggle("music"), toggle: true},
            {label: () => "SFX: " + onOff("sfx"),     action: () => this.toggle("sfx"), toggle: true},
            {label: () => "MAIN MENU", action: () => this.toMenu()}
        ]
        this.options.forEach((option, i) =>
        {
            option.text = addNesText(this, x + 22, y + 24 + i * 12, option.label())
                .setInteractive({cursor: 'pointer'})
            option.text.on('pointerover', () => this.select(i))
            option.text.on('pointerdown', () => { this.select(i); this.choose() })
        })

        // Cursor: a small pixel triangle pointing at the selected option.
        this.cursor = this.add.graphics()
        this.cursor.fillStyle(0xffffff, 1)
        for (let i = 0; i < 4; i++)
        {
            this.cursor.fillRect(i, i, 1, 7 - 2 * i)
        }
        this.cursorX = x + 12

        this.select(0)

        Hints.show([
            {action: "navigate", label: "SELECT"},
            {action: "confirm", label: "OK"},
            {action: "cancel", label: "RESUME"}
        ])
    }

    select(index)
    {
        this.selected = index
        this.options.forEach((option, i) => option.text.setColor(i == index ? "#ffffff" : "#a0a0a0"))
        this.cursor.setPosition(this.cursorX, this.options[index].text.y)
    }

    choose()
    {
        if (this.leaving) return
        this.options[this.selected].action()
    }

    // Switch music or sound effects and update the option's ON/OFF.
    toggle(kind)
    {
        AudioSettings.toggle(kind)
        let option = this.options[this.selected]
        option.text.setText(option.label())
        this.select(this.selected)
    }

    resume()
    {
        Hints.show(this.previousHints)
        if (this.online)
        {
            let level = this.scene.get(this.target)
            if (level.netSession && !level.netSession.dead && !level.netSession.over) level.player.canMove = true
        }
        else
        {
            this.sound.resumeAll()
            this.scene.resume(this.target)
        }
        this.scene.stop()
    }

    leaveRoom()
    {
        Net.leave()
        this.leave(() =>
        {
            this.scene.stop(this.target)
            this.scene.start("Menu", {skipIntro: true})
        })
    }

    // Fade the whole screen out, then run done.
    leave(done)
    {
        this.leaving = true
        Hints.hide()
        this.cameras.main.fadeOut(1500)
        this.cameras.main.once('camerafadeoutcomplete', () =>
        {
            this.sound.stopAll()
            this.sound.setVolume(1)
            done()
        })
    }

    restart()
    {
        this.leave(() =>
        {
            carriedCharge = 0 // Restarting counts as a fresh try.
            this.scene.get(this.target).scene.restart()
            this.scene.stop()
        })
    }

    toMenu()
    {
        this.leave(() =>
        {
            this.scene.stop(this.target)
            this.scene.start("Menu", {skipIntro: true})
        })
    }

    update()
    {
        if (this.leaving) return

        let count = this.options.length
        if (GameInput.justPressed("down")) this.select((this.selected + 1) % count)
        if (GameInput.justPressed("up"))   this.select((this.selected + count - 1) % count)

        let option = this.options[this.selected]
        if (GameInput.justPressed("confirm") ||
            (option.toggle && (GameInput.justPressed("left") || GameInput.justPressed("right"))))
        {
            this.choose()
        }
        else if (GameInput.justPressed("pause") || GameInput.justPressed("cancel"))
        {
            this.resume()
        }
    }
}
