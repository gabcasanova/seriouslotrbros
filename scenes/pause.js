// Pause menu, launched on top of a paused Level or Balrog scene.
const PAUSE_LIST_WIDTH = 136 // Online: the window listing the room's players.
const PAUSE_LIST_GAP = 8
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
            Pause.standStill(scene.player)
            scene.scene.launch("Pause", {target: scene.scene.key, hints: Hints.current, online: true})
            return
        }
        scene.sound.pauseAll()
        scene.scene.launch("Pause", {target: scene.scene.key, hints: Hints.current})
        scene.scene.pause()
    }

    // Online pause: the player stops where they are and stands idle (the
    // others see them standing, not running on the spot).
    static standStill(player)
    {
        player.canMove = false
        player.setVelocityX(0)
        if (player.isSonic)
        {
            player.gsp = 0
            player.skidding = player.spindashing = false
            if (player.body.onFloor()) player.rolling = player.isBall = false
            if (player.isBall) return // Still curled up in the air.
        }
        player.play("idle", true)
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
        let h = 28 + (this.online ? 3 : 4) * 12 // Room for each option.
        // Online, the room's players (and deathmatch scores) are listed
        // beside the menu, so the pair is centered together.
        let x = Math.round((config.width - w - (this.online ? PAUSE_LIST_GAP + PAUSE_LIST_WIDTH : 0)) / 2)
        let y = Math.round((config.height - h) / 2)
        if (this.online) this.makePlayerList(x + w + PAUSE_LIST_GAP)

        drawWindow(this.add.graphics(), x, y, w, h)
        addNesText(this, x + w / 2, y + 8, "PAUSE", "#ffffff", true)

        let volume = {label: () => "VOLUME: " + AudioSettings.volume, action: () => this.changeVolume(1), volume: true}
        this.options = this.online ? [
            {label: () => "RESUME",     action: () => this.resume()},
            volume,
            {label: () => "LEAVE ROOM", action: () => this.leaveRoom()}
        ] : [
            {label: () => "RESUME",    action: () => this.resume()},
            {label: () => "RESTART",   action: () => this.restart()},
            volume,
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

    // Online: who's in the room, in their colors. In deathmatch, their
    // kills too, best first. Kept up to date while the menu is open.
    makePlayerList(x)
    {
        this.listX = x
        this.listObjects = []
        this.refreshPlayerList()
        Net.listen(this, "room", () => this.refreshPlayerList())
        Net.listen(this, "left", () => this.refreshPlayerList())
    }

    refreshPlayerList()
    {
        this.listObjects.forEach(o => o.destroy())

        let deathmatch = Net.settings.mode == "deathmatch"
        let players = [...Net.players.values()]
        if (deathmatch) players.sort((a, b) => (Net.scores[b.id] || 0) - (Net.scores[a.id] || 0))

        let w = PAUSE_LIST_WIDTH
        let h = 28 + players.length * 12
        let x = this.listX
        let y = Math.round((config.height - h) / 2)
        this.listObjects = [drawWindow(this.add.graphics(), x, y, w, h)]
        this.listObjects.push(addNesText(this, x + w / 2, y + 8, deathmatch ? "KILLS" : "PLAYERS", "#ffffff", true))
        players.forEach((p, i) =>
        {
            let row = y + 24 + i * 12
            let color = (PLAYER_COLORS[p.color] || PLAYER_COLORS[0]).hex || "#ffffff"
            this.listObjects.push(addNesText(this, x + 14, row, p.name, color))
            if (deathmatch)
            {
                let kills = String(Net.scores[p.id] || 0).padStart(3, " ")
                this.listObjects.push(addNesText(this, x + w - 38, row, kills, "#ffffff"))
            }
        })
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

    // Volume up (OK, right) or down (left), 0 to 100.
    changeVolume(dir)
    {
        if (dir > 0 && AudioSettings.volume >= 100 && !this.stepping) AudioSettings.set(0) // OK wraps around.
        else AudioSettings.step(dir)
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
            let net = level.netSession
            // Not if we're down, out, or already waiting at the exit.
            if (net && !net.dead && !net.over && !net.arrived && !level.levelFinished) level.player.canMove = true
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
            this.sound.setVolume(AudioSettings.volume / 100)
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

        // Online the stage goes on underneath: when it ends (everyone made
        // it to the exit, the room closed), the menu closes with it.
        if (this.online)
        {
            let level = this.scene.get(this.target)
            if (!level.sys.isActive() || level.levelFinished) { this.scene.stop(); return }
        }

        let count = this.options.length
        if (GameInput.justPressed("down")) this.select((this.selected + 1) % count)
        if (GameInput.justPressed("up"))   this.select((this.selected + count - 1) % count)

        let option = this.options[this.selected]
        if (option.volume && (GameInput.justPressed("left") || GameInput.justPressed("right")))
        {
            this.stepping = true
            this.changeVolume(GameInput.justPressed("left") ? -1 : 1)
            this.stepping = false
        }
        else if (GameInput.justPressed("confirm"))
        {
            this.choose()
        }
        else if (GameInput.justPressed("pause") || GameInput.justPressed("cancel"))
        {
            this.resume()
        }
    }
}
