// Online play, peer-to-peer with PeerJS (WebRTC). The host's browser holds
// the room: everyone connects to it, and it relays every message to the
// others (a star). Rooms are found by a short code: the host's peer id is
// NET_PREFIX + code, on PeerJS's free public matchmaking server.
const NET_PREFIX = "slotrb-"
const NET_MAX_PLAYERS = 8
const NET_CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // No 0/O, 1/I.
// Messages only the host may send. One arriving from a player is dropped,
// not relayed: otherwise anyone could rewrite the room for everyone.
const NET_HOST_ONLY = new Set(["room", "start", "go", "finish", "arrivals", "matchEnd", "welcome", "full", "version"])

const Net = {
    peer: null,
    isHost: false,
    code: null,
    me: null,            // {id, name, character, color}
    players: new Map(),  // id -> {id, name, character, color}
    conns: new Map(),    // Host only: id -> connection.
    hostConn: null,      // Clients only.
    settings: {mode: "coop", stage: 0},
    scores: {},          // Deathmatch kills, id -> count.
    inGame: false,       // In a networked stage right now.
    joinAttempt: 0,
    handlers: {},

    get active() { return !!this.peer && !!this.code },

    on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn) },
    off(type, fn) { this.handlers[type] = (this.handlers[type] || []).filter(f => f != fn) },
    emit(type, msg) { (this.handlers[type] || []).slice().forEach(fn => fn(msg)) },

    // Handler that's removed when `scene` shuts down.
    listen(scene, type, fn)
    {
        fn.owner = scene
        this.on(type, fn)
        if (!scene.netCleanup)
        {
            scene.netCleanup = true
            scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.offAll(scene); scene.netCleanup = false })
        }
    },

    // Removes every handler a scene added.
    offAll(owner)
    {
        for (let type in this.handlers) this.handlers[type] = this.handlers[type].filter(f => f.owner != owner)
    },

    newCode()
    {
        let code = ""
        for (let i = 0; i < 5; i++) code += NET_CODE_LETTERS[Math.floor(Math.random() * NET_CODE_LETTERS.length)]
        return code
    },

    // Host a room. Resolves with its code.
    create(profile)
    {
        this.leave()
        return new Promise((resolve, reject) =>
        {
            let code = this.newCode()
            let peer = new Peer(NET_PREFIX + code)
            peer.on("open", (id) =>
            {
                this.peer = peer
                this.isHost = true
                this.code = code
                this.me = Object.assign({id: id}, profile)
                this.players = new Map([[id, this.me]])
                this.scores = {}
                resolve(code)
            })
            peer.on("connection", (conn) => this.accept(conn))
            peer.on("error", (err) =>
            {
                if (!this.peer) reject(err)
                else console.warn("Net:", err.type)
            })
        })
    },

    // Join a room by code.
    join(code, profile)
    {
        this.leave()
        code = code.toUpperCase().trim()
        // Each attempt only ever cleans up after itself: a failed one (or its
        // timeout firing late) must never touch a later, working connection.
        let attempt = ++this.joinAttempt
        return new Promise((resolve, reject) =>
        {
            let peer = new Peer()
            let timeout = null
            let done = false
            let failed = (err) =>
            {
                if (done) return
                done = true
                clearTimeout(timeout)
                try { peer.destroy() } catch (e) {}
                if (attempt == this.joinAttempt && this.peer == peer) this.leave()
                reject(err)
            }
            peer.on("error", (err) => { if (!this.hostConn || !this.hostConn.open) failed(err) })
            peer.on("open", (id) =>
            {
                if (done) return
                let conn = peer.connect(NET_PREFIX + code, {reliable: true})
                timeout = setTimeout(() => failed({type: "timeout"}), 10000)
                conn.on("open", () =>
                {
                    if (done || attempt != this.joinAttempt) return
                    clearTimeout(timeout)
                    this.peer = peer
                    this.isHost = false
                    this.code = code
                    this.hostConn = conn
                    this.me = Object.assign({id: id}, profile)
                    conn.send({t: "hello", profile: profile, version: GAME_VERSION})
                })
                conn.on("data", (msg) =>
                {
                    if (!msg || typeof msg != "object") return
                    if (msg.t == "full") { failed({type: "full"}); return }
                    if (msg.t == "version") { failed({type: "version", older: msg.version > GAME_VERSION}); return }
                    if (msg.t == "welcome") { done = true; resolve(code) }
                    this.receive(msg)
                })
                conn.on("close", () => { if (this.hostConn == conn) this.lostHost() })
            })
        })
    },

    // Host: a new player connecting.
    accept(conn)
    {
        conn.on("data", (msg) =>
        {
            if (!msg || typeof msg != "object" || typeof msg.t != "string") return
            msg.from = conn.peer
            if (msg.t == "hello")
            {
                // A different version of the game (one of us has an old copy
                // cached): playing together would go wrong in odd ways.
                if (msg.version !== GAME_VERSION)
                {
                    conn.send({t: "version", version: GAME_VERSION})
                    setTimeout(() => conn.close(), 500)
                    return
                }
                if (this.players.size >= NET_MAX_PLAYERS || this.inGame)
                {
                    conn.send({t: "full"})
                    setTimeout(() => conn.close(), 500)
                    return
                }
                this.conns.set(conn.peer, conn)
                this.players.set(conn.peer, Object.assign({id: conn.peer}, this.cleanProfile(msg.profile)))
                conn.send({t: "welcome"})
                this.sendRoom()
                return
            }
            if (!this.conns.has(conn.peer) || NET_HOST_ONLY.has(msg.t)) return
            // Pass it on to everyone else, and handle it here too.
            this.relay(msg, conn.peer)
            this.receive(msg)
        })
        conn.on("close", () =>
        {
            if (!this.isHost || !this.conns.has(conn.peer)) return // We left.
            this.conns.delete(conn.peer)
            this.players.delete(conn.peer)
            this.sendRoom()
            this.emit("left", {id: conn.peer})
        })
    },

    relay(msg, except)
    {
        for (let [id, conn] of this.conns) if (id != except && conn.open) conn.send(msg)
    },

    // Sends to everyone else in the room (not back to ourselves).
    send(msg)
    {
        if (!this.active) return
        msg.from = this.me.id
        if (this.isHost) this.relay(msg)
        else if (this.hostConn && this.hostConn.open) this.hostConn.send(msg)
    },

    // Host: tells everyone who's in the room and the chosen mode and stage.
    sendRoom()
    {
        if (!this.isHost) return
        let msg = {t: "room", players: [...this.players.values()], settings: this.settings, scores: this.scores}
        this.relay(msg)
        this.receive(msg)
    },

    receive(msg)
    {
        if (!msg || typeof msg != "object") return
        if (msg.t == "room")
        {
            let players = (Array.isArray(msg.players) ? msg.players : []).slice(0, NET_MAX_PLAYERS)
                .map(p => Object.assign({id: this.cleanId(p && p.id)}, this.cleanProfile(p)))
            this.players = new Map(players.map(p => [p.id, p]))
            this.settings = this.cleanSettings(msg.settings)
            this.scores = this.cleanScores(msg.scores)
        }
        if (msg.t == "start") msg.settings = this.cleanSettings(msg.settings)
        this.emit(msg.t, msg)
    },

    // ---- Checking what arrives ------------------------------------------------
    // A modified copy of the game could send anything, and names and stages
    // end up in the lobby's HTML. So everything is rebuilt from known-good
    // values, never passed on as it came.

    cleanProfile(p)
    {
        p = p || {}
        let name = String(p.name || "").toUpperCase().replace(/[^A-Z0-9 .!?-]/g, "").trim().slice(0, 10)
        return {
            name: name || "PLAYER",
            character: ["sonic", "pierre"].includes(p.character) ? p.character : "frodo",
            color: Number.isInteger(p.color) && PLAYER_COLORS[p.color] ? p.color : 0
        }
    },

    // Peer ids are letters, digits and dashes.
    cleanId(id)
    {
        return String(id || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 64)
    },

    cleanStage(stage)
    {
        return ONLINE_STAGES.includes(stage) ? stage : ONLINE_STAGES[0]
    },

    cleanSettings(s)
    {
        s = s || {}
        let clean = {
            mode: s.mode == "deathmatch" ? "deathmatch" : "coop",
            stage: this.cleanStage(s.stage),
            seed: Number.isInteger(s.seed) ? Math.abs(s.seed) % 1000 : 0,
            vote: null
        }
        let v = s.vote
        if (v && Array.isArray(v.options))
        {
            let votes = {}
            for (let id in (v.votes || {})) if (ONLINE_STAGES.includes(v.votes[id])) votes[this.cleanId(id)] = v.votes[id]
            clean.vote = {
                options: v.options.filter(o => ONLINE_STAGES.includes(o)).slice(0, VOTE_CHOICES),
                votes: votes,
                left: Phaser.Math.Clamp(Number(v.left) || 0, 0, VOTE_TIME)
            }
        }
        return clean
    },

    cleanScores(scores)
    {
        let clean = {}
        for (let id in (scores || {})) if (Number.isInteger(scores[id])) clean[this.cleanId(id)] = Math.max(0, scores[id])
        return clean
    },

    // Host: a player died in deathmatch; `by` scores a point.
    scoreKill(by)
    {
        if (!this.isHost || !by) return
        this.scores[by] = (this.scores[by] || 0) + 1
        this.sendRoom()
    },

    lostHost()
    {
        this.leave()
        this.emit("hostLeft", {})
    },

    // Our own leaving. Everything is reset before the connection closes, so
    // the close isn't mistaken for the host leaving (or someone else leaving).
    leave()
    {
        let peer = this.peer
        this.peer = null
        this.code = null
        this.isHost = false
        this.hostConn = null
        this.conns = new Map()
        this.players = new Map()
        this.inGame = false
        if (peer)
        {
            try { peer.destroy() } catch (e) {}
        }
    },

    // The saved online profile (name, character, color).
    loadProfile()
    {
        let profile = {name: "PLAYER", character: "frodo", color: 0}
        try { Object.assign(profile, JSON.parse(localStorage.getItem("onlineProfile")) || {}) } catch (e) {}
        profile = this.cleanProfile(profile)
        if (profile.character != "frodo" && !ShopStore.owns(profile.character)) profile.character = "frodo"
        return profile
    },

    saveProfile(profile)
    {
        try { localStorage.setItem("onlineProfile", JSON.stringify(profile)) } catch (e) {}
    }
}

window.addEventListener("beforeunload", () => Net.leave())
