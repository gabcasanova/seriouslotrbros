// A networked stage: shows the other players (smoothly following what they
// send), puts names over everyone's heads, and runs the mode's rules.
//   Co-op: everyone plays the stage together, each with their own enemies
//   and coins; the host starts the stage; reaching the end clears it for
//   all; whoever dies goes back to the start.
//   Deathmatch: no enemies; sword shots and Sonic's ball hurt players; each
//   kill scores a point; matches last DEATHMATCH_TIME.
const NET_SEND_INTERVAL = 50 // ms between position updates (20 a second).
const DEATHMATCH_TIME = 180000 // Three minutes.
const NET_RESPAWN_TIME = 2000

// Off-screen markers: where each character's face is in its idle frame.
const MARKER_FACE = {frodo: {x: 8, y: 1, w: 14, h: 11}, sonic: {x: 7, y: 8, w: 18, h: 15}, pierre: {x: 25, y: 17, w: 18, h: 14}}
const MARKER_SIZE = 21 // The marker's circle (odd, so it has a center pixel).

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
                this.hitMe(shot.owner, shot.damage, shot.charge)
                shot.destroy()
            })
        }

        // Our name, over our head.
        let me = Net.me
        this.myTag = this.makeTag(me)

        let on = (type, fn) => Net.listen(scene, type, fn)
        on("state", (msg) => this.onState(msg))
        on("shot", (msg) => this.onShot(msg))
        on("left", (msg) => { this.removeRemote(msg.id); this.checkArrivals() })
        on("hostLeft", () => this.quit("THE HOST LEFT THE ROOM"))
        on("died", (msg) => { if (Net.isHost) Net.scoreKill(msg.by) })
        on("room", () => this.updateScore())
        on("matchEnd", () => this.showResults())
        on("hitFx", (msg) =>
        {
            if (msg.level != currentLevel) return
            hitSpark(scene, msg.x, msg.y)
            // Our sword hit them: it charges the super, like hitting enemies.
            if (msg.by == Net.me.id && msg.charge) scene.player.addCharge(msg.charge)
        })
        if (this.mode == "coop")
        {
            // Only the players and the stage's start and end are shared:
            // everyone has their own enemies, coins and items.
            on("go", (msg) => { if (msg.level == currentLevel && scene.briefing) { scene.intro.skip(); scene.startLevel() } })
            on("finish", () => scene.reachEnd(true))
            on("arrived", (msg) => this.markArrived(msg.from))
            on("key", (msg) => this.onKey(msg.color))
            on("block", (msg) => this.onBlock(msg.id))
            on("riderHit", (msg) => this.onRiderHit(msg.pinches, msg.health))
            on("arrivals", (msg) => this.showWaiting(msg.count, msg.total))
        }

        if (this.mode == "deathmatch")
        {
            let cx = config.width / 2
            this.timerText = addNesText(scene, cx, 6, "3:00", "#ffffff", true, true).setScrollFactor(0).setDepth(6)
            this.scoreText = addNesText(scene, cx, 17, "KILLS 0", "#f8b800", true, true).setScrollFactor(0).setDepth(6)
            this.leaderText = addNesText(scene, cx, 28, "", "#ffffff", true, true).setScrollFactor(0).setDepth(6)
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
        // Pierre's cell is taller than he is: his name goes by Frodo's height.
        let top = sprite.tagTop || (sprite.isPierre ? PIERRE.body.h / 2 : sprite.displayHeight / 2)
        tag.y = Math.round(sprite.y - top - 12)
    }

    // ---- Off-screen markers ------------------------------------------------------

    // A player out of view shows at the screen's edge: their face in a
    // circle of their color, with an arrow pointing their way. No name.
    makeMarker(profile, key)
    {
        let scene = this.scene
        let character = profile.character
        let hex = PLAYER_COLORS[profile.color].hex || CLASSIC_COLOR[character]

        let face = scene.add.image(0, 0, this.markerTexture(key, character, hex))

        // Points right; turned toward the player each frame.
        let arrow = scene.add.graphics()
        arrow.fillStyle(Phaser.Display.Color.HexStringToColor(hex).color, 1)
        for (let i = 0; i < 3; i++) arrow.fillRect(i, i - 2, 1, 5 - 2 * i)

        let marker = scene.add.container(0, 0, [face, arrow]).setScrollFactor(0).setDepth(6).setVisible(false)
        marker.face = face
        marker.arrow = arrow
        return marker
    }

    // A pixel circle: a ring in the player's color, black inside, and the
    // face from their texture's idle frame. Made once per texture.
    markerTexture(key, character, hex)
    {
        let markerKey = key + "_marker"
        let textures = this.scene.textures
        if (textures.exists(markerKey)) return markerKey

        let size = MARKER_SIZE
        let crop = MARKER_FACE[character]
        let frame = textures.getFrame(key, character == "sonic" ? SONIC_ANIM_FRAMES.idle[0] : 0)
        let faceCanvas = document.createElement("canvas")
        faceCanvas.width = size
        faceCanvas.height = size
        faceCanvas.getContext("2d").drawImage(frame.source.image, frame.cutX + crop.x, frame.cutY + crop.y, crop.w, crop.h,
            Math.floor((size - crop.w) / 2), Math.floor((size - crop.h) / 2), crop.w, crop.h)
        let face = faceCanvas.getContext("2d").getImageData(0, 0, size, size).data

        let canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        let ctx = canvas.getContext("2d")
        let image = ctx.createImageData(size, size)
        let ring = Phaser.Display.Color.HexStringToColor(hex)
        let c = (size - 1) / 2
        let radius = size / 2
        for (let y = 0; y < size; y++)
        {
            for (let x = 0; x < size; x++)
            {
                let d = Math.hypot(x - c, y - c)
                if (d > radius - 0.3) continue // Outside.
                let i = (y * size + x) * 4
                if (d > radius - 1.6) { image.data[i] = ring.red; image.data[i + 1] = ring.green; image.data[i + 2] = ring.blue }
                else if (face[i + 3] > 0) { image.data[i] = face[i]; image.data[i + 1] = face[i + 1]; image.data[i + 2] = face[i + 2] }
                image.data[i + 3] = 255 // Black where there's no face.
            }
        }
        ctx.putImageData(image, 0, 0)
        textures.addCanvas(markerKey, canvas)
        return markerKey
    }

    placeMarker(r)
    {
        let marker = r.marker
        let s = r.sprite
        let cam = this.scene.cameras.main
        let bounds = Overlay.visibleBounds()
        let x = s.x - cam.scrollX
        let y = s.y - cam.scrollY

        let onScreen = x > bounds.left - 8 && x < bounds.right + 8 && y > -16 && y < config.height + 16
        marker.setVisible(s.visible && !onScreen && !this.scene.briefing && !this.over)
        if (!marker.visible) return

        // Kept clear of the HUD: the lives bar on the left, the top rows and
        // the control hints at the bottom.
        let mx = Phaser.Math.Clamp(x, bounds.left + 28, bounds.right - 14)
        let my = Phaser.Math.Clamp(y, 44, config.height - 26)
        marker.setPosition(Math.round(mx), Math.round(my))

        // Arrow on the side facing the player; the face looks that way too.
        let dx = x - mx
        let dy = y - my
        let arrow = marker.arrow
        if (Math.abs(dx) >= Math.abs(dy))
        {
            arrow.setAngle(dx > 0 ? 0 : 180)
            arrow.setPosition(dx > 0 ? MARKER_SIZE / 2 + 1 : -MARKER_SIZE / 2 - 1, 0)
        }
        else
        {
            arrow.setAngle(dy > 0 ? 90 : -90)
            arrow.setPosition(0, dy > 0 ? MARKER_SIZE / 2 + 1 : -MARKER_SIZE / 2 - 1)
        }
        marker.face.flipX = dx < 0
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
            if (profile.character == "pierre") { sprite.setOrigin(0.5, PIERRE.originY); sprite.tagTop = PIERRE.body.h / 2 }
            r = {sprite: sprite, key: key, tag: this.makeTag(profile), marker: this.makeMarker(profile, key), state: msg}
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
        r.marker.destroy()
        this.remotes.delete(id)
    }

    onShot(msg)
    {
        if (msg.level != currentLevel) return
        let profile = Net.players.get(msg.from)
        let pierre = profile && profile.character == "pierre"
        let shot = msg.mega ? (pierre ? new SuperPaint(this.scene, msg.x, msg.y, msg.left) : new MegaSlash(this.scene, msg.x, msg.y, msg.left))
            : pierre ? new PaintShot(this.scene, msg.x, msg.y, msg.left)
            : new Projectile(this.scene, msg.x, msg.y, msg.left, "playerProjectile", 160, 30)
        shot.owner = msg.from
        shot.damage = msg.mega ? 2 : 1
        shot.charge = msg.mega ? 0 : 1 // What the hit gives its owner's super.
        this.remoteShots.add(shot)
    }

    // Our shots, so the others see (and in deathmatch, feel) them.
    sendShot(x, y, left, mega)
    {
        Net.send({t: "shot", level: currentLevel, x: Math.round(x), y: Math.round(y), left: left, mega: !!mega})
    }

    // ---- Co-op sharing: keys, key walls and the Black Rider ----------------------

    shareKey(color)
    {
        if (this.mode == "coop") Net.send({t: "key", color: color})
    }

    onKey(color)
    {
        this.scene.player.keys[color] = true
        // That key is gone for everyone.
        this.scene.children.list.filter(o => o instanceof Item && o.keyColor == color).forEach(o => o.destroy())
    }

    shareBlock(id)
    {
        if (this.mode == "coop" && id !== undefined) Net.send({t: "block", id: id})
    }

    onBlock(id)
    {
        let block = this.scene.children.list.find(o => o instanceof Item && o.netId == id)
        if (block) block.destroy()
    }

    shareRiderHit(pinches, health)
    {
        if (this.mode == "coop") Net.send({t: "riderHit", pinches: pinches, health: health})
    }

    onRiderHit(pinches, health)
    {
        let rider = this.scene.children.list.find(o => o instanceof BlackRider)
        if (rider) rider.syncHealth(pinches, health)
    }

    // ---- Co-op exit: everyone has to get there ---------------------------------

    // We reached the end: wait there (safe) until the others do too.
    arrive()
    {
        if (this.arrived) return
        this.arrived = true
        let player = this.scene.player
        player.canMove = false
        player.setVelocityX(0)
        player.play("idle", true)
        Hints.hide()
        this.showWaiting(1, Net.players.size)
        Net.send({t: "arrived"})
        if (Net.isHost) this.markArrived(Net.me.id)
    }

    // Host: count who's at the exit; when it's everyone, clear the stage.
    markArrived(id)
    {
        if (!Net.isHost || this.scene.levelFinished) return
        this.arrivedIds = this.arrivedIds || new Set()
        this.arrivedIds.add(id)
        this.checkArrivals()
    }

    checkArrivals()
    {
        if (!Net.isHost || !this.arrivedIds || this.scene.levelFinished) return
        // Only count players still in the room.
        for (let id of this.arrivedIds) if (!Net.players.has(id)) this.arrivedIds.delete(id)
        let count = this.arrivedIds.size
        let total = Net.players.size
        Net.send({t: "arrivals", count: count, total: total})
        if (this.arrived) this.showWaiting(count, total)

        if (count >= total && count > 0)
        {
            Net.send({t: "finish"})
            this.scene.reachEnd(true)
        }
    }

    showWaiting(count, total)
    {
        if (!this.arrived) return
        let text = "WAITING FOR THE OTHERS " + count + "/" + total
        if (!this.waitingText)
        {
            this.waitingText = addNesText(this.scene, config.width / 2, 40, text, "#f8b800", true, true)
                .setScrollFactor(0).setDepth(6)
        }
        this.waitingText.setText(text)
        this.waitingText.x = Math.round(config.width / 2 - this.waitingText.width / 2)
    }

    clearWaiting()
    {
        if (this.waitingText) this.waitingText.destroy()
        this.waitingText = null
    }

    // ---- Getting hit (deathmatch) ---------------------------------------------

    // Another player hit us. Only our own screen decides this, so the hit
    // always counts against us, never against them.
    // charge: how much the hit fills the attacker's super (sword shots).
    hitMe(by, damage, charge)
    {
        let player = this.scene.player
        if (this.dead || this.over || !player.timer.execute) return // Still flashing.
        player.hurt(by, damage)

        // Everyone sees the impact on us.
        let x = Math.round(player.x)
        let y = Math.round(player.y)
        hitSpark(this.scene, x, y)
        Net.send({t: "hitFx", level: currentLevel, x: x, y: y, by: by, charge: charge || 0})
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
        // Co-op: back to the stage's start. Deathmatch: one of the stage's
        // spawn spots. Nothing else resets.
        let spot = this.spawnSpot()
        let x = spot.x
        let y = spot.y - 20

        player.body.enable = true
        player.body.reset(x, y)
        player.setVisible(true)
        player.lives = 4
        player.fading = false
        // Still in the menu: moving waits for resume.
        if (scene.scene.isActive("Pause")) Pause.standStill(player)
        else player.canMove = true
        player.timer.execute = false
        player.timer.current = player.timer.max // A moment of flashing safety.
        if (player.isSonic) player.gsp = 0
        this.dead = false
    }

    // Deathmatch start: a different spawn spot for each player. Players are
    // taken in id order and the host's seed turns who gets which, so every
    // screen agrees and each match starts differently.
    startSpot()
    {
        let points = this.scene.spawnPoints
        let ids = [...Net.players.keys()].sort()
        let i = Math.max(0, ids.indexOf(Net.me.id))
        return points[(i + (Net.settings.seed || 0)) % points.length]
    }

    // A random spawn spot, away from the others if one is free.
    spawnSpot()
    {
        let scene = this.scene
        let start = scene.layers[3].find(o => o.type == "playerStart")
        if (this.mode != "deathmatch" || !scene.spawnPoints || !scene.spawnPoints.length) return start

        let others = [...this.remotes.values()].map(r => r.sprite).filter(s => s.visible)
        let free = scene.spawnPoints.filter(p => others.every(o => Phaser.Math.Distance.Between(p.x, p.y, o.x, o.y) > 80))
        return Phaser.Utils.Array.GetRandom(free.length ? free : scene.spawnPoints)
    }

    // ---- Deathmatch clock and results ----------------------------------------

    startClock()
    {
        this.clockStart = this.scene.time.now
    }

    updateScore()
    {
        if (!this.scoreText) return
        this.scoreText.setText("KILLS " + (Net.scores[Net.me.id] || 0))
        this.scoreText.x = Math.round(config.width / 2 - this.scoreText.width / 2)

        // Who's in the lead (nobody until the first kill).
        let players = [...Net.players.values()]
        let best = Math.max(0, ...players.map(p => Net.scores[p.id] || 0))
        let leaders = players.filter(p => (Net.scores[p.id] || 0) == best)
        let text = ""
        let color = "#ffffff"
        if (best > 0 && leaders.length > 1) text = "TIED FOR THE LEAD"
        else if (best > 0 && leaders[0].id == Net.me.id) text = "YOU ARE IN THE LEAD"
        else if (best > 0)
        {
            text = leaders[0].name + " IS IN THE LEAD"
            color = (PLAYER_COLORS[leaders[0].color] || PLAYER_COLORS[0]).hex || color
        }
        this.leaderText.setText(text)
        this.leaderText.setColor(color)
        this.leaderText.x = Math.round(config.width / 2 - this.leaderText.width / 2)
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
        this.scene.scene.stop("Pause") // The results take over the screen.
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
                // To the half pixel: sprites sit on half pixels (33 tall), and a
                // rounded y would draw others a pixel low, feet in the grass.
                x: Math.round(player.x * 2) / 2, y: Math.round(player.y * 2) / 2, fx: player.flipX,
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
            // Close enough: land exactly there, not a fraction off.
            if (Math.abs(r.state.x - s.x) < 0.5) s.x = r.state.x
            if (Math.abs(r.state.y - s.y) < 0.5) s.y = r.state.y
            this.placeTag(r.tag, s)
            this.placeMarker(r)

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
