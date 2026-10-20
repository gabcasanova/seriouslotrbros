// Online lobby, in three pages:
//   "setup": your name, character and color.
//   "rooms": create or join a room; in a room, the host picks the mode and
//            stage and starts.
//   "vote":  after a deathmatch, everyone votes for the next stage.
// The form is HTML in the overlay, for real text boxes; the character
// preview is drawn in the game.

// Stages that work online (not the horse ride, not the Balrog fight).
const ONLINE_STAGES = LEVEL_SELECT.filter(e => !e.scene && e.level != 6).map(e => e.level)
const VOTE_TIME = 60000 // One minute (or until everyone has voted).
const VOTE_CHOICES = 3
// Vote times use the game loop's clock: a scene's own clock reads 0 while
// it's being created.
const NEED_PLAYERS = "YOU NEED AT LEAST 2 PLAYERS"

class Online extends Phaser.Scene
{
    constructor()
    {
        super({key: "Online"})
    }

    preload()
    {
        this.load.spritesheet("frodo", "assets/sprites/frodo.png", {frameWidth: 33, frameHeight: 33})
        this.load.image("sonicRaw", "assets/sprites/sonic.png")
        this.load.audio("menuMove", "assets/sounds/coin.wav")
    }

    create(data)
    {
        data = data || {}
        this.cameras.main.fadeIn(1000)
        buildSonicSprites(this)
        Hints.hide()

        // In a room: the profile you joined with.
        this.profile = Net.active ? {name: Net.me.name, character: Net.me.character, color: Net.me.color} : Net.loadProfile()
        this.message = data.message || ""
        this.busy = false
        // Phaser reuses the scene object, so forget the last room's code.
        this.code = null
        // Back here because the room ended (e.g. the host left mid-stage):
        // straight to the rooms page.
        this.page = Net.active ? (data.vote ? "vote" : "rooms") : (data.message ? "rooms" : "setup")
        this.voteChoice = 0

        addNesText(this, 72, 30, "ONLINE", "#ffffff", true)
        this.preview = this.add.sprite(72, 120, "frodo", 0).setScale(3)
        this.previewName = addNesText(this, 72, 64, "", "#ffffff", true, true)

        this.panel = document.createElement("div")
        this.panel.className = "online-panel"
        Overlay.root.appendChild(this.panel)
        this.panel.addEventListener("click", (e) => this.click(e))
        this.panel.addEventListener("input", (e) => this.typed(e))
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.panel.remove())

        Net.listen(this, "room", () => this.onRoom())
        Net.listen(this, "left", () => this.render())
        Net.listen(this, "start", (msg) => this.startGame(msg.settings))
        Net.listen(this, "vote", (msg) => this.recordVote(msg.from, msg.stage))
        Net.listen(this, "hostLeft", () =>
        {
            // That room is gone: forget its code.
            this.code = null
            this.page = "rooms"
            this.message = "THE HOST LEFT THE ROOM"
            this.render()
        })

        Net.inGame = false
        if (this.page == "vote" && Net.isHost) this.startVote()
        if (this.page == "vote" && !Net.isHost)
        {
            // No vote coming (the host went back to the room): show the room.
            this.time.delayedCall(3000, () => { if (this.page == "vote" && !Net.settings.vote) { this.page = "rooms"; this.render() } })
        }
        this.render()
    }

    onRoom()
    {
        // The host started or ended a vote.
        let vote = Net.settings.vote
        if (vote && this.page != "vote") this.page = "vote"
        if (!vote && this.page == "vote") this.page = "rooms"
        if (vote) this.voteReceivedAt = this.game.loop.time
        // Someone joined: the "need 2 players" note no longer applies.
        if (Net.players.size >= 2 && this.message == NEED_PLAYERS) this.message = ""
        this.render()
    }

    // ---- Pages ---------------------------------------------------------------

    render()
    {
        let html = ""
        if (this.page == "setup") html = this.setupPage()
        else if (this.page == "rooms") html = Net.active ? this.roomPage() : this.roomsPage()
        else html = this.votePage()

        if (this.message) html += `<p class="message">${this.message}</p>`
        this.panel.innerHTML = html
        this.drawThumbs()
        this.updatePreview()
    }

    setupPage()
    {
        let p = this.profile
        let canSonic = ShopStore.owns("sonic")
        let colors = PLAYER_COLORS.map((c, i) =>
            `<button data-color="${i}" class="swatch${i == p.color ? " on" : ""}" title="${c.name}"
                style="background:${c.hex || (p.character == "sonic" ? "#2038ec" : "#386900")}"></button>`).join("")
        return `
            <h3>YOUR PLAYER</h3>
            <label>NAME</label>
            <input data-field="name" maxlength="10" value="${p.name}">
            <label>CHARACTER</label>
            <div class="row">
                <button data-char="frodo" class="${p.character == "frodo" ? "on" : ""}">FRODO</button>
                <button data-char="sonic" class="${p.character == "sonic" ? "on" : ""}" ${canSonic ? "" : "disabled"}>${canSonic ? "SONIC" : "SONIC (SHOP)"}</button>
            </div>
            <label>COLOR: ${PLAYER_COLORS[p.color].name}</label>
            <div class="row swatches">${colors}</div>
            <div class="row">
                <button data-act="next" class="big">NEXT</button>
                <button data-act="back">BACK</button>
            </div>`
    }

    roomsPage()
    {
        return `
            <h3>ROOMS</h3>
            <div class="row"><button data-act="create" class="big">CREATE ROOM</button></div>
            <label>OR JOIN WITH A CODE</label>
            <div class="row">
                <input data-field="code" maxlength="5" placeholder="CODE" value="${this.code || ""}">
                <button data-act="join">JOIN</button>
            </div>
            <div class="row"><button data-act="setup">CHANGE PLAYER</button></div>`
    }

    roomPage()
    {
        let host = Net.isHost
        let s = Net.settings
        let entry = LEVEL_SELECT.find(e => e.level == s.stage && !e.scene)
        let players = [...Net.players.values()].map(pl =>
            `<li style="color:${PLAYER_COLORS[pl.color].hex || "#fcfcfc"}">${pl.name} <span>${pl.character.toUpperCase()}${pl.id == Net.me.id ? " (YOU)" : ""}${pl.id == this.hostId() ? " HOST" : ""}</span></li>`).join("")

        return `
            <h3>ROOM <b class="code">${Net.code}</b> <span class="dim">${Net.players.size}/${NET_MAX_PLAYERS}</span></h3>
            <div class="row"><button data-act="copyCode">COPY CODE</button></div>
            <ul class="players">${players}</ul>
            <label>MODE</label>
            <div class="row">
                <button data-mode="coop" class="${s.mode == "coop" ? "on" : ""}" ${host ? "" : "disabled"}>CO-OP</button>
                <button data-mode="deathmatch" class="${s.mode == "deathmatch" ? "on" : ""}" ${host ? "" : "disabled"}>DEATHMATCH</button>
            </div>
            <label>STAGE</label>
            <div class="row stage-pick">
                <button data-stage="-1" ${host ? "" : "disabled"}>&lt;</button>
                <div class="stage-card">
                    <canvas class="thumb" data-thumb="${s.stage}" width="256" height="144"></canvas>
                    <span>${this.stageName(entry)}</span>
                </div>
                <button data-stage="1" ${host ? "" : "disabled"}>&gt;</button>
            </div>
            <div class="row">
                ${!host ? `<span>WAITING FOR THE HOST...</span>`
                    : Net.players.size < 2 ? `<span class="dim">WAITING FOR PLAYERS...</span>`
                    : `<button data-act="start" class="big">START</button>`}
                <button data-act="leave">LEAVE</button>
            </div>`
    }

    votePage()
    {
        let vote = Net.settings.vote
        if (!vote) return `<h3>NEXT STAGE</h3><p>WAITING FOR THE VOTE...</p>`

        let mine = vote.votes[Net.me.id]
        let left = Math.max(0, Math.ceil((vote.left - (this.game.loop.time - (this.voteReceivedAt || this.game.loop.time))) / 1000))
        let cards = vote.options.map((stage, i) =>
        {
            let entry = LEVEL_SELECT.find(e => e.level == stage && !e.scene)
            let voters = [...Net.players.values()].filter(p => vote.votes[p.id] == stage)
                .map(p => `<i style="background:${PLAYER_COLORS[p.color].hex || "#fcfcfc"}" title="${p.name}"></i>`).join("")
            let cls = (mine == stage ? " on" : "") + (i == this.voteChoice ? " focus" : "")
            return `<button data-vote="${stage}" class="vote-card${cls}">
                <canvas class="thumb" data-thumb="${stage}" width="256" height="144"></canvas>
                <span>${this.stageName(entry)}</span>
                <div class="voters">${voters}</div>
            </button>`
        }).join("")

        return `
            <h3>VOTE FOR THE NEXT STAGE <span class="dim" data-timer>${left}</span></h3>
            <div class="row votes">${cards}</div>
            <div class="row">
                ${Net.isHost ? `<button data-act="endVote">BACK TO ROOM</button>` : ""}
                <button data-act="leave">LEAVE</button>
            </div>`
    }

    stageName(entry)
    {
        return entry.title + " " + entry.act.replace("WORLD ", "").replace(" - ACT ", "-")
    }

    hostId()
    {
        return NET_PREFIX + Net.code
    }

    // Stage pictures from the level select, cropped the same way.
    drawThumbs()
    {
        this.panel.querySelectorAll("canvas[data-thumb]").forEach(canvas =>
        {
            let stage = Number(canvas.dataset.thumb)
            let entry = LEVEL_SELECT.find(e => e.level == stage && !e.scene)
            let image = Online.thumbs[stage]
            let draw = () =>
            {
                let ctx = canvas.getContext("2d")
                ctx.imageSmoothingEnabled = false
                ctx.drawImage(image, entry.cropX, entry.cropY, 256, 144, 0, 0, 256, 144)
            }
            if (!image)
            {
                image = Online.thumbs[stage] = new Image()
                image.src = "assets/levelselect/level" + LEVEL_SELECT.indexOf(entry) + ".png"
            }
            if (image.complete && image.naturalWidth) draw()
            else image.addEventListener("load", draw, {once: true})
        })
    }

    updatePreview()
    {
        let p = this.profile
        this.preview.setTexture(playerTexture(this, p.character, p.color), p.character == "sonic" ? SONIC_ANIM_FRAMES.idle[0] : 0)
        this.previewName.setText(p.name || "PLAYER")
        this.previewName.x = Math.round(72 - this.previewName.width / 2)
        this.previewName.y = Math.round(this.preview.y - this.preview.displayHeight / 2 - 12)
    }

    // ---- Input ---------------------------------------------------------------

    typed(e)
    {
        let field = e.target.dataset.field
        if (field == "name")
        {
            // The NES font: capitals, digits and a few marks only.
            let clean = e.target.value.toUpperCase().replace(/[^A-Z0-9 .!?-]/g, "")
            if (clean != e.target.value) e.target.value = clean
            this.profile.name = clean.trim() || "PLAYER"
            Net.saveProfile(this.profile)
            this.updatePreview()
        }
        else if (field == "code")
        {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
            this.code = e.target.value
        }
    }

    click(e)
    {
        let b = e.target.closest("button")
        if (!b || b.disabled || this.busy) return
        b.blur()
        let d = b.dataset

        if (d.char) { this.profile.character = d.char; Net.saveProfile(this.profile); this.render() }
        else if (d.color) { this.profile.color = Number(d.color); Net.saveProfile(this.profile); this.render() }
        else if (d.mode && Net.isHost) { Net.settings.mode = d.mode; Net.sendRoom() }
        else if (d.stage && Net.isHost)
        {
            let i = ONLINE_STAGES.indexOf(Net.settings.stage)
            let n = ONLINE_STAGES.length
            Net.settings.stage = ONLINE_STAGES[(i + Number(d.stage) + n) % n]
            Net.sendRoom()
        }
        else if (d.vote) this.castVote(Number(d.vote))
        else if (d.act == "next") this.toRooms()
        else if (d.act == "setup") { this.page = "setup"; this.message = ""; this.render() }
        else if (d.act == "create") this.createRoom()
        else if (d.act == "join") this.joinRoom(this.code || "")
        else if (d.act == "copyCode") this.copy(Net.code, "CODE COPIED: " + Net.code)
        else if (d.act == "leave") { Net.leave(); this.page = "rooms"; this.message = ""; this.render() }
        else if (d.act == "start") this.hostStart()
        else if (d.act == "endVote") this.endVote()
        else if (d.act == "back") this.back()
    }

    toRooms()
    {
        Net.saveProfile(this.profile)
        this.page = "rooms"
        this.message = ""
        this.render()
    }

    // ---- Rooms ---------------------------------------------------------------

    createRoom()
    {
        this.busy = true
        this.say("CREATING ROOM...")
        Net.settings = {mode: "coop", stage: ONLINE_STAGES[0]}
        Net.create(this.profile)
            .then(() => { this.busy = false; this.message = ""; Net.sendRoom() })
            .catch((err) => { this.busy = false; this.say(this.errorText(err)) })
    }

    joinRoom(code)
    {
        if (code.length < 5) { this.say("ENTER THE 5-LETTER CODE"); return }
        this.busy = true
        this.code = code
        this.say("JOINING " + code.toUpperCase() + "...")
        Net.join(code, this.profile)
            .then(() => { this.busy = false; this.message = ""; this.render() })
            .catch((err) =>
            {
                this.busy = false
                this.code = null // Don't keep offering a room that's gone.
                this.page = "rooms"
                this.say(this.errorText(err))
            })
    }

    errorText(err)
    {
        let type = err && err.type
        if (type == "peer-unavailable" || type == "timeout") return "NO ROOM WITH THAT CODE"
        if (type == "full") return "THAT ROOM IS FULL OR PLAYING"
        if (type == "network" || type == "server-error" || type == "socket-error") return "CAN'T REACH THE ONLINE SERVER"
        return "COULDN'T CONNECT. TRY AGAIN"
    }

    // Copies text; falls back to a hidden text box where the clipboard API
    // isn't allowed (e.g. inside some embeds).
    copy(text, done)
    {
        let fallback = () =>
        {
            let box = document.createElement("textarea")
            box.value = text
            box.style.cssText = "position:fixed;left:-1000px;top:0"
            document.body.appendChild(box)
            box.select()
            let ok = false
            try { ok = document.execCommand("copy") } catch (e) {}
            box.remove()
            this.say(ok ? done : "COPY THIS: " + text)
        }
        if (navigator.clipboard && window.isSecureContext)
        {
            navigator.clipboard.writeText(text).then(() => this.say(done)).catch(fallback)
        }
        else fallback()
    }

    say(text)
    {
        this.message = text
        this.render()
    }

    hostStart()
    {
        // Online needs company.
        if (Net.players.size < 2)
        {
            if (Net.settings.vote) this.endVote()
            this.say(NEED_PLAYERS)
            return
        }
        Net.scores = {}
        Net.settings.vote = null
        let settings = Object.assign({}, Net.settings)
        Net.send({t: "start", settings: settings})
        this.startGame(settings)
    }

    // Everyone: go to the chosen stage.
    startGame(settings)
    {
        Net.settings = settings
        Net.scores = {}
        Net.inGame = true
        carriedCharge = 0
        currentLevel = settings.stage
        this.cameras.main.fadeOut(600)
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("Level"))
    }

    // ---- Deathmatch vote -------------------------------------------------------

    // Host: offer a few stages (not the one just played).
    startVote()
    {
        let pool = Phaser.Utils.Array.Shuffle(ONLINE_STAGES.filter(s => s != Net.settings.stage))
        Net.settings.vote = {options: pool.slice(0, VOTE_CHOICES), votes: {}, left: VOTE_TIME}
        this.voteEndsAt = this.game.loop.time + VOTE_TIME
        this.voteReceivedAt = this.game.loop.time
        Net.sendRoom()
        this.voteTimer = this.time.delayedCall(VOTE_TIME, () => this.finishVote())
    }

    castVote(stage)
    {
        let vote = Net.settings.vote
        if (!vote) return
        this.voteChoice = vote.options.indexOf(stage)
        this.sound.play("menuMove")
        if (Net.isHost) this.recordVote(Net.me.id, stage)
        else
        {
            vote.votes[Net.me.id] = stage // Shown now; the host confirms it.
            Net.send({t: "vote", stage: stage})
            this.render()
        }
    }

    // Host: count a vote and tell everyone.
    recordVote(id, stage)
    {
        let vote = Net.settings.vote
        if (!Net.isHost || !vote || !vote.options.includes(stage)) return
        vote.votes[id] = stage
        vote.left = this.voteEndsAt - this.game.loop.time
        Net.sendRoom()

        // Everyone voted: no need to wait out the clock.
        if ([...Net.players.keys()].every(p => vote.votes[p] !== undefined))
        {
            if (this.voteTimer) this.voteTimer.remove()
            this.time.delayedCall(1200, () => this.finishVote())
        }
    }

    // Host: the most votes wins (ties and no votes: a random pick of those).
    finishVote()
    {
        let vote = Net.settings.vote
        if (!vote) return
        let counts = vote.options.map(s => Object.values(vote.votes).filter(v => v == s).length)
        let best = Math.max(...counts)
        let winners = vote.options.filter((s, i) => counts[i] == best)
        Net.settings.stage = Phaser.Utils.Array.GetRandom(winners)
        this.hostStart()
    }

    endVote()
    {
        if (this.voteTimer) this.voteTimer.remove()
        Net.settings.vote = null
        this.page = "rooms"
        Net.sendRoom()
    }

    back()
    {
        Net.leave()
        this.cameras.main.fadeOut(600)
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("Menu", {skipIntro: true}))
    }

    update(time, delta)
    {
        if (this.page == "setup" && !Net.active && GameInput.justPressed("cancel")) this.back()

        // Host: re-send the vote every second, for anyone who arrived late
        // (and to keep everyone's countdown in step).
        if (Net.isHost && Net.settings.vote)
        {
            this.voteResend = (this.voteResend || 0) + delta
            if (this.voteResend >= 1000)
            {
                this.voteResend = 0
                Net.settings.vote.left = this.voteEndsAt - this.game.loop.time
                Net.sendRoom()
            }
        }

        if (this.page == "vote" && Net.settings.vote)
        {
            // Keyboard / gamepad voting.
            let n = Net.settings.vote.options.length
            if (GameInput.justPressed("left"))  { this.voteChoice = (this.voteChoice + n - 1) % n; this.render() }
            if (GameInput.justPressed("right")) { this.voteChoice = (this.voteChoice + 1) % n; this.render() }
            if (GameInput.justPressed("confirm")) this.castVote(Net.settings.vote.options[this.voteChoice])

            // Countdown.
            let timer = this.panel.querySelector("[data-timer]")
            let vote = Net.settings.vote
            if (timer)
            {
                let left = Math.max(0, Math.ceil((vote.left - (this.game.loop.time - this.voteReceivedAt)) / 1000))
                if (timer.textContent != String(left)) timer.textContent = left
            }
        }
    }
}
Online.thumbs = {}
