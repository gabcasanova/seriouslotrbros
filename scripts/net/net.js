// Online play, peer-to-peer with PeerJS (WebRTC). The host's browser holds
// the room: everyone connects to it, and it relays every message to the
// others (a star). Rooms are found by a short code: the host's peer id is
// NET_PREFIX + code, on PeerJS's free public matchmaking server.
const NET_PREFIX = "slotrb-"
const NET_MAX_PLAYERS = 8
const NET_CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // No 0/O, 1/I.

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
                    conn.send({t: "hello", profile: profile})
                })
                conn.on("data", (msg) =>
                {
                    if (msg.t == "full") { failed({type: "full"}); return }
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
            msg.from = conn.peer
            if (msg.t == "hello")
            {
                if (this.players.size >= NET_MAX_PLAYERS || this.inGame)
                {
                    conn.send({t: "full"})
                    setTimeout(() => conn.close(), 500)
                    return
                }
                this.conns.set(conn.peer, conn)
                this.players.set(conn.peer, Object.assign({id: conn.peer}, msg.profile))
                conn.send({t: "welcome"})
                this.sendRoom()
                return
            }
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
        if (msg.t == "room")
        {
            this.players = new Map(msg.players.map(p => [p.id, p]))
            this.settings = msg.settings
            this.scores = msg.scores || {}
        }
        this.emit(msg.t, msg)
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
        if (profile.character == "sonic" && !ShopStore.owns("sonic")) profile.character = "frodo"
        return profile
    },

    saveProfile(profile)
    {
        try { localStorage.setItem("onlineProfile", JSON.stringify(profile)) } catch (e) {}
    }
}

window.addEventListener("beforeunload", () => Net.leave())
