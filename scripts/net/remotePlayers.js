// A networked stage: shows the other players (smoothly following what they
// send), puts names over everyone's heads, and runs the mode's rules.
//   Co-op: everyone plays the stage together, each with their own enemies
//   and coins; the host starts the stage; reaching the end clears it for
//   all; whoever dies goes back to the start.
//   Deathmatch: no enemies; sword shots and Sonic's ball hurt players; each
//   kill scores a point; matches last DEATHMATCH_TIME.
const NET_SEND_INTERVAL = 50 // ms between position updates (20 a second).
const DEATHMATCH_TIME = 60000
const NET_RESPAWN_TIME = 2000

class NetSession
{
    constructor(scene)
    {
        this.scene = scene
        this.mode = Net.settings.mode
        this.remotes = new Map()
        this.sendTimer = 0
        this.dead = false
        this.over = false

        this.remoteShots = scene.physics.add.group()
        if (this.mode == "deathmatch")
        {
            // Their shots hurt us.
            scene.physics.add.overlap(scene.player, this.remoteShots, (player, shot) =>
            {
                if (this.dead || this.over) return
                this.hitMe(shot.owner, shot.damage)
                shot.destroy()
            })
        }

        // Our name, over our head.
        let me = Net.me
        this.myTag = this.makeTag(me)

        let on = (type, fn) => Net.listen(scene, type, fn)
        on("state", (msg) => this.onState(msg))
        on("shot", (msg) => this.onShot(msg))
        on("left", (msg) => this.removeRemote(msg.id))
        on("hostLeft", () => this.quit("THE HOST LEFT THE ROOM"))
        on("died", (msg) => { if (Net.isHost) Net.scoreKill(msg.by) })
        on("room", () => this.updateScore())
        on("matchEnd", () => this.showResults())
        on("hitFx", (msg) => { if (msg.level == currentLevel) hitSpark(scene, msg.x, msg.y) })
        if (this.mode == "coop")
        {
            // Only the players and the stage's start and end are shared:
            // everyone has their own enemies, coins and items.
            on("go", (msg) => { if (msg.level == currentLevel && scene.briefing) { scene.intro.skip(); scene.startLevel() } })
            on("finish", () => scene.reachEnd(true))
        }

        if (this.mode == "deathmatch")
        {
            let cx = config.width / 2
            this.timerText = addNesText(scene, cx, 6, "1:00", "#ffffff", true, true).setScrollFactor(0).setDepth(6)
            this.scoreText = addNesText(scene, cx, 17, "KILLS 0", "#f8b800", true, true).setScrollFactor(0).setDepth(6)
        }
    }

    makeTag(profile)
    {
        let color = PLAYER_COLORS[profile.color].hex || "#ffffff"
        return addNesText(this.scene, 0, 0, profile.name, color, true, true).setDepth(6)
    }

    placeTag(tag, sprite)
    {
        // Hidden while the stage's story card is up.
        tag.setVisible(sprite.visible && !this.scene.briefing)
        tag.x = Math.round(sprite.x - tag.width / 2)
        tag.y = Math.round(sprite.y - sprite.displayHeight / 2 - 12)
    }

    // ---- Other players --------------------------------------------------------

    onState(msg)
    {
        if (msg.level != currentLevel) return
        let profile = Net.players.get(msg.from)
        if (!profile) return

        let r = this.remotes.get(msg.from)
        if (!r)
        {
            if (profile.character == "sonic") buildSonicSprites(this.scene)
            let key = playerTexture(this.scene, profile.character, profile.color)
            // Same layer as our own player: behind the foreground (grass).
            let sprite = this.scene.add.sprite(msg.x, msg.y, key, 0).setDepth(0.99)
            r = {sprite: sprite, key: key, tag: this.makeTag(profile), state: msg}
            this.remotes.set(msg.from, r)
        }
        r.state = msg
        r.sprite.setFrame(msg.frame)
        r.sprite.flipX = msg.fx
        r.sprite.setVisible(!msg.dead)
        r.sprite.setAlpha(msg.alpha)
    }

    removeRemote(id)
    {
        let r = this.remotes.get(id)
        if (!r) return
        r.sprite.destroy()
        r.tag.destroy()
        this.remotes.delete(id)
    }

    onShot(msg)
    {
        if (msg.level != currentLevel) return
        let shot = msg.mega
            ? new MegaSlash(this.scene, msg.x, msg.y, msg.left)
            : new Projectile(this.scene, msg.x, msg.y, msg.left, "playerProjectile", 160, 30)
        shot.owner = msg.from
        shot.damage = msg.mega ? 2 : 1
        this.remoteShots.add(shot)
    }

    // Our shots, so the others see (and in deathmatch, feel) them.
    sendShot(x, y, left, mega)
    {
        Net.send({t: "shot", level: currentLevel, x: Math.round(x), y: Math.round(y), left: left, mega: !!mega})
    }

    // ---- Getting hit (deathmatch) ---------------------------------------------

    // Another player hit us. Only our own screen decides this, so the hit
    // always counts against us, never against them.
    hitMe(by, damage)
    {
        let player = this.scene.player
        if (this.dead || this.over || !player.timer.execute) return // Still flashing.
        player.hurt(by, damage)

        // Everyone sees the impact on us.
        let x = Math.round(player.x)
        let y = Math.round(player.y)
        hitSpark(this.scene, x, y)
        Net.send({t: "hitFx", level: currentLevel, x: x, y: y})
    }

    // Our attacks reaching the others: shots stop on them (the mega slash
    // goes through), and Sonic bounces off them. The damage itself is
    // worked out on their screens.
    attackFeedback(r)
    {
        let player = this.scene.player
        let bounds = r.sprite.getBounds()
        for (let shot of player.projectileGroup.getChildren().slice())
        {
            if (Phaser.Geom.Intersects.RectangleToRectangle(shot.getBounds(), bounds)) shot.destroy()
        }

        if (player.isSonic && player.isBall && !r.state.ball && !player.body.onFloor() && player.body.velocity.y > 0 &&
            Phaser.Geom.Intersects.RectangleToRectangle(player.body, bounds))
        {
            player.setVelocityY(-SONIC.bounce)
            player.jumping = true
        }
    }

    // ---- Dying -------------------------------------------------------------

    // Instead of restarting the stage: drop out, score the kill, come back.
    localDied()
    {
        if (this.dead) return
        this.dead = true
        let player = this.scene.player
        player.setVisible(false)
        player.body.enable = false
        Net.send({t: "died", by: player.lastHitBy || null})
        if (Net.isHost) Net.scoreKill(player.lastHitBy)

        this.scene.time.delayedCall(NET_RESPAWN_TIME, () => this.respawn())
    }

    respawn()
    {
        if (this.over) return
        let scene = this.scene
        let player = scene.player
        // Back to the stage's starting point; nothing else resets.
        let start = scene.layers[3].find(o => o.type == "playerStart")
        let x = start.x
        let y = start.y - 20

        player.body.enable = true
        player.body.reset(x, y)
        player.setVisible(true)
        player.lives = 4
        player.fading = false
        player.canMove = true
        player.timer.execute = false
        player.timer.current = player.timer.max // A moment of flashing safety.
        if (player.isSonic) player.gsp = 0
        this.dead = false
    }

    // ---- Deathmatch clock and results ----------------------------------------

    startClock()
    {
        this.clockStart = this.scene.time.now
    }

    updateScore()
    {
        if (this.scoreText) this.scoreText.setText("KILLS " + (Net.scores[Net.me.id] || 0))
        if (this.scoreText) this.scoreText.x = Math.round(config.width / 2 - this.scoreText.width / 2)
    }

    tickClock()
    {
        if (this.clockStart === undefined || this.over) return
        let left = Math.max(0, DEATHMATCH_TIME - (this.scene.time.now - this.clockStart))
        let secs = Math.ceil(left / 1000)
        this.timerText.setText(Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0"))
        this.timerText.setColor(secs <= 10 ? "#db4161" : "#ffffff")

        if (left == 0)
        {
            // The host's clock decides; others show results if it's late.
            if (Net.isHost) { Net.send({t: "matchEnd"}); this.showResults() }
            else this.scene.time.delayedCall(3000, () => this.showResults())
            this.freeze()
        }
    }

    freeze()
    {
        let player = this.scene.player
        player.canMove = false
        player.setVelocityX(0)
    }

    showResults()
    {
        if (this.over) return
        this.over = true
        this.freeze()
        Hints.hide()

        let scene = this.scene
        let ranking = [...Net.players.values()].sort((a, b) => (Net.scores[b.id] || 0) - (Net.scores[a.id] || 0))
        let w = 200
        let h = 30 + ranking.length * 12
        let x = Math.round((config.width - w) / 2)
        let y = Math.round((config.height - h) / 2)
        let objects = [drawWindow(scene.add.graphics(), x, y, w, h).setScrollFactor(0).setDepth(20)]
        objects.push(addNesText(scene, config.width / 2, y + 8, "TIME UP!", "#f8b800", true))
        ranking.forEach((p, i) =>
        {
            let color = PLAYER_COLORS[p.color].hex || "#ffffff"
            objects.push(addNesText(scene, x + 14, y + 24 + i * 12, (i + 1) + ". " + p.name, color))
            objects.push(addNesText(scene, x + w - 46, y + 24 + i * 12, String(Net.scores[p.id] || 0).padStart(3, " "), "#ffffff"))
        })
        objects.forEach(o => o.setScrollFactor(0).setDepth(20))

        // Then vote for the next stage.
        scene.time.delayedCall(6000, () => this.backToRoom(true))
    }

    backToRoom(vote)
    {
        Net.inGame = false
        this.scene.sound.stopAll()
        this.scene.scene.start("Online", {vote: !!vote})
    }

    quit(message)
    {
        Net.inGame = false
        this.scene.sound.stopAll()
        this.scene.scene.start("Online", {message: message})
    }

    // Host: tell everyone to start the stage, and keep repeating it for a few
    // seconds for anyone still loading it.
    sendGo()
    {
        let level = currentLevel
        let count = 0
        let send = () =>
        {
            if (!this.scene.sys.isActive() || currentLevel != level) return
            Net.send({t: "go", level: level})
            if (++count < 10) this.scene.time.delayedCall(1000, send)
        }
        send()
    }

    // ---- Every frame -----------------------------------------------------------

    update(delta)
    {
        let player = this.scene.player

        // Send where we are.
        this.sendTimer += delta
        if (this.sendTimer >= NET_SEND_INTERVAL)
        {
            this.sendTimer = 0
            Net.send({
                t: "state", level: currentLevel,
                x: Math.round(player.x), y: Math.round(player.y), fx: player.flipX,
                frame: player.frame.name, alpha: Math.round(player.alpha * 10) / 10,
                ball: !!(player.isSonic && player.isBall), dead: this.dead
            })
        }

        // Others glide to where they last said they were.
        for (let r of this.remotes.values())
        {
            let s = r.sprite
            s.x += (r.state.x - s.x) * 0.35
            s.y += (r.state.y - s.y) * 0.35
            this.placeTag(r.tag, s)

            if (this.mode == "deathmatch" && s.visible && !this.dead && !this.over)
            {
                this.attackFeedback(r)

                // Sonic rolling into us.
                if (r.state.ball && Phaser.Geom.Intersects.RectangleToRectangle(s.getBounds(), player.body) &&
                    !(player.isSonic && player.isBall)) // Both curled up: no harm.
                {
                    this.hitMe(r.state.from, 1)
                }
            }
        }
        this.placeTag(this.myTag, player)

        if (this.mode == "deathmatch") this.tickClock()
    }
}

// 8-bit impact burst: a white star that pops out and blinks away.
function hitSpark(scene, x, y)
{
    let g = scene.add.graphics({x: x, y: y}).setDepth(7)
    g.fillStyle(0xffffff, 1)
    // Plus and diagonal rays, two pixels thick.
    for (let i = 3; i <= 9; i += 2)
    {
        g.fillRect(-1, -i - 1, 2, 2); g.fillRect(-1, i - 1, 2, 2)
        g.fillRect(-i - 1, -1, 2, 2); g.fillRect(i - 1, -1, 2, 2)
        if (i <= 7)
        {
            g.fillRect(i - 1, i - 1, 2, 2); g.fillRect(-i - 1, i - 1, 2, 2)
            g.fillRect(i - 1, -i - 1, 2, 2); g.fillRect(-i - 1, -i - 1, 2, 2)
        }
    }
    g.fillRect(-2, -2, 4, 4)
    g.setScale(0.5)
    scene.tweens.add({targets: g, scale: 1.25, duration: 160, ease: "Stepped", easeParams: [3]})
    scene.tweens.add({targets: g, alpha: 0, delay: 160, duration: 160, ease: "Stepped", easeParams: [2], onComplete: () => g.destroy()})
    scene.sound.play("sword")
}
