class Level extends Phaser.Scene 
{
    constructor()
    {
        super({key: "Level"})
    }

    preload()
    {
        // Clear cache.
        //console.log(this.cache)
        this.cache.tilemap.remove("tilemap")
		this.cache.audio.remove("levelMusic")
		this.textures.remove("background0")
		this.textures.remove("background1")
		this.textures.remove("background2")

        // Load images.
        this.load.image("playerProjectile", "assets/sprites/playerProjectile.png")
		this.load.image("goblinAxe", "assets/sprites/goblinAxe.png")
		this.load.image("aiFucked", "assets/sprites/aiFucked.png")
        this.load.image("blackscreen", "assets/cutscenes/blackscreen.png")

        // Load spritesheets.
        this.load.spritesheet("gotThrough", "assets/sprites/gotThrough.png", {frameWidth: 197, frameHeight: 54})
        this.load.spritesheet("cutsceneLevel", "assets/cutscenes/cutsceneLevel.png", {frameWidth: 256, frameHeight: 240})
        this.load.json("stages", "assets/stages.json")
        this.load.spritesheet("frodo", "assets/sprites/frodo.png", {frameWidth: 33, frameHeight: 33})
        this.load.image("sonicRaw", "assets/sprites/sonic.png")

        // Sonic's sounds (Shop item).
        if (ShopStore.owns("sonic"))
        {
            this.load.audio("ring", "assets/sounds/ring.mp3")
            this.load.audio("sonicJump", "assets/sounds/sonicJump.mp3")
            this.load.audio("sonicSpring", "assets/sounds/sonicSpringBounce.mp3")
            this.load.audio("sonicSpin", "assets/sounds/spin.mp3")
            this.load.audio("sonicDash", "assets/sounds/dash.mp3")
            this.load.audio("sonicKill", "assets/sounds/sonicKill.wav")
        }
        this.load.spritesheet("sam", "assets/sprites/sam.png", {frameWidth: 33, frameHeight: 33})
        this.load.spritesheet("lifebar", "assets/sprites/lifebar.png", {frameWidth: 8, frameHeight: 62})
        this.load.spritesheet("enemies", "assets/sprites/enemies.png", {frameWidth: 16, frameHeight: 42})
		this.load.spritesheet("blackrider", "assets/sprites/blackrider.png", {frameWidth: 63, frameHeight: 68})
		this.load.spritesheet("bossHealthBar", "assets/sprites/bossHealthBar.png", {frameWidth: 42, frameHeight: 9})
		this.load.spritesheet("legolasHorse", "assets/sprites/legolasHorse.png", {frameWidth: 92, frameHeight: 95})

        // Load map.
        this.load.image("tileset", "assets/sprites/tileset.png")
        this.load.spritesheet("items", "assets/sprites/items.png", {frameWidth: 16, frameHeight: 16})
        this.load.tilemapTiledJSON("tilemap", levels[currentLevel].dir)

        // Load backgrounds.
        this.load.image("background0", levels[currentLevel].backgrounds[0])
        this.load.image("background1", levels[currentLevel].backgrounds[1])
        this.load.image("background2", levels[currentLevel].backgrounds[2])

        // Load sounds.
        this.load.audio("coin", "assets/sounds/coin.wav")
        this.load.audio("jump", "assets/sounds/jump.wav")
        this.load.audio("bump", "assets/sounds/bump.wav")
        this.load.audio("life", "assets/sounds/life.wav")
        this.load.audio("spring","assets/sounds/spring.mp3")
        this.load.audio("enemy", "assets/sounds/enemy.wav")
		this.load.audio("sword", "assets/sounds/sword.wav")

        // Load music.
        this.load.audio("fanfare", "assets/music/fanfare.mp3")
        this.load.audio("actClear", "assets/music/actClear.mp3")
        this.load.audio("levelMusic", levels[currentLevel].music)
		this.load.audio("bossMusic", "assets/music/bossMusic.mp3")

        // Load level specific assets.
        if (currentLevel >= 7)
        {
            this.load.spritesheet("gandalfSprites", "assets/sprites/gandalfSprites.png", {frameWidth: 46, frameHeight: 74})

            if (currentLevel <= 8)
            {
                this.load.image("caradhrasSnow", "assets/backgrounds/caradhrasSnow.png")
                this.load.image("caradhrasSnowSmall", "assets/backgrounds/caradhrasSnowSmall.png")
                this.load.spritesheet("aragornSprites", "assets/sprites/aragornSprites.png", {frameWidth: 45, frameHeight: 66})
                this.load.spritesheet("legolasSprites", "assets/sprites/legolasSprites.png", {frameWidth: 45, frameHeight: 66})
            }
        }
    }

    create()
    {
        // Online: "coop" or "deathmatch" (see NetSession), else null.
        this.online = Net.inGame ? Net.settings.mode : null
        this.netSession = null

        // Mission briefing.
        this.cameras.main.fadeIn(500)
        this.sound.play("fanfare")

        let blackscreen = this.add.sprite(config.width/2, config.height/2, "blackscreen", currentLevel)
        blackscreen.setDepth(4)
        blackscreen.setScrollFactor(0, 0)

        blackscreen.setInteractive({cursor: 'pointer'})

        // Picture, story and stage name (text from assets/stages.json).
        let intro = buildStageIntro(this, currentLevel, 4)
        this.intro = intro

        // Titlecard: the story types itself out. A click, key or button shows
        // all of it, and the next one starts the level.
        this.advanceIntro = () =>
        {
            if (this.online && !Net.isHost) return // The host starts it for everyone.
            if (!this.intro.done) this.intro.skip()
            else this.startLevel()
        }
        this.briefing = true
        this.startLevel = () =>
        {
            if (!this.briefing) return
            this.briefing = false
            if (this.online == "coop" && Net.isHost) this.netSession.sendGo()

            intro.objects.forEach(o => o.destroy())
            blackscreen.destroy()
            this.player.waitJumpRelease = true
            this.sound.stopAll()
            let levelMusic = this.sound.add("levelMusic", {loop: true}).play()

            if (currentLevel >= 7 && currentLevel <= 8)
            {
                this.caradhrasSnow.visible = true
                this.caradhrasSnowSmall.visible = true
            }

            // Fade into the stage; the player can move once it's done.
            Hints.hide()
            this.cameras.main.fadeEffect.start(false, 1800, 0, 0, 0, true)
            this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () =>
            {
                this.player.canMove = true
                this.showPlayHints()
                if (this.netSession && this.online == "deathmatch") this.netSession.startClock()
            })
        }

        blackscreen.on('pointerdown', () => this.advanceIntro());
        if (this.online && !Net.isHost)
        {
            Hints.hide()
            intro.objects.push(addNesText(this, config.width / 2, 192, "WAITING FOR THE HOST", "#f8b800", true, true)
                .setScrollFactor(0).setDepth(5))
        }
        else Hints.show([{action: "confirm", label: "SKIP"}])
		
		// Enemy projectiles group.
		this.enemyProjectiles = this.physics.add.group()

        // Create player. Sonic (from the Shop) takes Frodo's place, but not
        // on the horse ride.
        this.sonic = ShopStore.isOn("sonic") && currentLevel <= 8 && currentLevel != 6
        if (this.online)
        {
            // Online: your own character and color, on every stage.
            this.sonic = Net.me.character == "sonic"
            if (this.sonic) buildSonicSprites(this)
            this.player = new Player(this, 200, 100, playerTexture(this, this.sonic ? "sonic" : "frodo", Net.me.color))
        }
        else if (this.sonic)
        {
            buildSonicSprites(this)
            this.player = new Player(this, 200, 100, "sonicSheet")
        }
        else if (currentLevel <= 8)
        {
            this.player = new Player(this, 200, 100, "frodo")
        }
        else
        {
            this.player = new Player(this, 200, 100, "gandalfSprites")
        }

        // Import map and tileset.
        let map     = this.make.tilemap({key: "tilemap"})
        let tileset = map.addTilesetImage("tileset", "tileset")
        this.layers  = [
            map.createLayer(0, tileset, 0, 0),       // Background.
            map.createLayer(1, tileset, 0, 0),       // Collisions.
            map.createLayer(2, tileset, 0, 0),       // Foreground.
            map.getObjectLayer("Objects")["objects"] // Objects.
        ]

        this.layers[1].setCollisionByExclusion([-1])
        this.layers[2].depth = 1
        this.cameras.main.setBounds(0, 0, map.width * map.tileWidth, map.height * map.tileHeight)

        // The stage's left, right and bottom edges are solid walls, so nobody
        // can fall out of it. The top stays open for high spring jumps.
        this.physics.world.setBounds(0, 0, map.width * map.tileWidth, map.height * map.tileHeight, true, true, false, true)
        this.player.setCollideWorldBounds(true)

        this.physics.add.collider(this.player, this.layers[1]);

        // Ai Player.
        this.hasAiPlayer = true
        this.aiPlayer = new AiPlayer(this, this.player.x - 5, this.player.y, "sam", 30)
        this.physics.add.collider(this.aiPlayer, this.layers[1]);
		
		this.importObjects(this.layers[3]) // Import objects from map.
		if (this.coinIds.length != COINS_PER_STAGE[currentLevel])
		{
			console.warn("Stage " + currentLevel + " has " + this.coinIds.length + " coins; update COINS_PER_STAGE in scripts/coins.js.")
		}
		
		// Destroy AI player if disabled in map (or online: real friends instead).
        if (!map.properties[0].value || this.online)
        {
            this.aiPlayer.destroy()
        }

        // Import parallax backgrounds.
        this.add.image(config.width/2, config.height/2, "background0").setScrollFactor(0).setDepth(-1)
        createParallax(this, config.width * 30, "background1", 0.25)
        createParallax(this, config.width * 30, "background2", 0.5)

        // Drop shadows for the level, cast onto the backgrounds.
        this.shadows = new LevelShadows(this, this.layers.slice(0, 3))

        // GUI.
        this.lifebar = this.add.sprite(10, config.height/2, "lifebar", this.player.lives)
        this.lifebar.setScrollFactor(0)
        this.lifebar.setDepth(3)
        this.lifebar.setVisible(!this.sonic || this.online == "deathmatch") // Sonic has rings instead.

        // Super charge bar and keys, top-left.
        if (this.player.canSuper()) this.player.charge = carriedCharge
        this.hud = new LevelHud(this)
        this.superShown = false
		
		this.cameraLock = false
        this.levelFinished = false

        // Check if level is caradhras.
        if (currentLevel >= 7 && currentLevel <= 8)
        {   // Snow.
            this.caradhrasSnow = this.add.tileSprite(0, 0, config.width, config.height, "caradhrasSnow")
            this.caradhrasSnow.setScrollFactor(0, 0)
            this.caradhrasSnow.setOrigin(0, 0)
            this.caradhrasSnow.depth = 100
            this.caradhrasSnow.visible = false

            this.caradhrasSnowSmall = this.add.tileSprite(0, 0, config.width, config.height, "caradhrasSnowSmall")
            this.caradhrasSnowSmall.setScrollFactor(0, 0)
            this.caradhrasSnowSmall.setOrigin(0, 0)
            this.caradhrasSnowSmall.setDepth(-1)
            this.caradhrasSnowSmall.visible = false

            // Ai Players (not online).
            if (!this.online)
            {
                let gandalf = new AiPlayer(this, this.player.x - 20, this.player.y, "gandalfSprites", 75)
                this.physics.add.collider(gandalf, this.layers[1]);

                let aragorn = new AiPlayer(this, this.player.x - 40, this.player.y, "aragornSprites", 135)
                this.physics.add.collider(aragorn, this.layers[1]);

                let legolas = new AiPlayer(this, this.player.x - 60, this.player.y, "legolasSprites", 195)
                this.physics.add.collider(legolas, this.layers[1]);
            }
        }

        // Online: the other players, names, and the mode's rules.
        if (this.online)
        {
            this.netSession = new NetSession(this)
            if (this.online == "deathmatch")
            {
                // Everyone starts at their own spawn spot, not all together.
                let spot = this.netSession.startSpot()
                this.player.body.reset(spot.x, spot.y)
                this.cameras.main.centerOn(spot.x, spot.y)
                // Straight into the fight.
                this.intro.skip()
                this.startLevel()
            }
        }
    }

    // Someone reached the end spot (remote: another player online did).
    reachEnd(remote)
    {
        if (this.levelFinished) return
        if (!remote && this.player.lives <= 0) return // Too late if dying.

        // Online co-op: wait at the exit until everyone is there.
        if (!remote && this.online == "coop") { this.netSession.arrive(); return }
        if (this.netSession) this.netSession.clearWaiting()

        this.levelFinished = true
        this.player.canMove = false
        this.player.setVelocityX(0)
        if (currentLevel != 6) this.player.play("idle")

        this.sound.stopAll()
        this.sound.play("actClear")
        this.finishLevel()
    }

    importObjects(layer)
    {
        // Coins in this stage, and the ones picked up this run.
        this.coinIds = []
        this.coinsCollected = new Set() // Map coins picked up (they don't come back).
        this.coinCount = 0               // Coins held now (Sonic can lose rings).

        // Deathmatch: just the stage and its hazards, no enemies or goals.
        const DEATHMATCH_SKIP = ["coin", "endSpot", "lockScreen", "shooter", "orc", "goblin", "bomb",
            "blackrider", "redKey", "yellowKey", "redBlock", "yellowBlock"]

        // Deathmatch: where players come back after dying. The stage's start
        // and its extra lives (which aren't pickups there), one spot per
        // bunch of lives.
        this.spawnPoints = []
        let addSpawn = (x, y) =>
        {
            if (this.spawnPoints.every(p => Phaser.Math.Distance.Between(p.x, p.y, x, y) > 48)) this.spawnPoints.push({x: x, y: y})
        }

        // Import objects from layer.
        layer.forEach(object => 
        {
            if (this.online == "deathmatch" && object.type == "life") { addSpawn(object.x + 8, object.y); return }
            if (this.online == "deathmatch" && DEATHMATCH_SKIP.includes(object.type)) return

            switch(object.type)
            {
                case "playerStart":
                    this.player.x = object.x
                    this.player.y = object.y
                    addSpawn(object.x, object.y)
                    break
                    
                case "coin":
                case "spike":
                case "spring":
				case "lockScreen":
                case "life":
				case "endSpot":
				case "bridge":
				case "redKey":
				case "yellowKey":
				case "redBlock":
				case "yellowBlock":
				case "shooter":
                    let item = new Item(this, object.x, object.y, object.type, object.flippedVertical, object.flippedHorizontal)
                    item.netId = object.id // Online co-op: shared key walls.
                    if (object.type == "coin")
                    {
                        item.coinId = object.id
                        if (this.sonic) item.play(ringAnimation(this)) // Coins become rings.
                        this.coinIds.push(object.id)
                    }
                    break
					
                case "orc":
				case "goblin":
				case "bomb":
                    let enemy = new Enemy(
                        this, object.x, object.y, object.type, 
                        object.properties[0].value, object.properties[1].value
                    )
                    break
					
				case "blackrider":
					let blackRider = new BlackRider(
						this, object.x, object.y,
						object.properties[0].value, object.properties[1].value
					)
					this.physics.add.collider(blackRider, this.layers[1]);
					break
            }
        })
    }

    showPlayHints()
    {
        if (currentLevel == 6)
        {
            // Horse level: Legolas rides on his own.
            Hints.show([
                {action: "back", label: "BRAKE"},
                {action: "jump", label: "JUMP"},
                {action: "pause", label: "PAUSE", top: true}
            ])
        }
        else
        {
            let hints = [
                {action: "move", label: "MOVE"},
                {action: "jump", label: "JUMP"},
                this.sonic ? {action: "spindash", label: "SPINDASH"} : {action: "attack", label: "ATTACK"}
            ]
            if (this.player.superReady()) hints.push({action: "super", label: "SUPER"})
            hints.push({action: "pause", label: this.online ? "MENU" : "PAUSE", top: true})
            Hints.show(hints)
        }
    }

    update()
    {
        if (this.briefing)
        {
            this.intro.update(this.game.loop.delta)
            if (GameInput.justPressed("confirm")) this.advanceIntro()
            if (this.briefing && this.intro.done && Hints.current.length && Hints.current[0].label != "START")
            {
                Hints.show([{action: "confirm", label: "START"}])
            }
        }
        else if (this.player.canMove && !this.levelFinished && this.player.lives > 0 && GameInput.justPressed("pause"))
        {
            Pause.open(this)
            return
        }

        // No controls to show once the level is over or the player died.
        if (!this.briefing && Hints.current.length && (this.levelFinished || this.player.lives <= 0))
        {
            Hints.hide()
        }

        // Show the SUPER control once the bar is full, hide it once used.
        if (this.player.canMove && !this.levelFinished && this.player.lives > 0 &&
            this.player.superReady() != this.superShown)
        {
            this.superShown = this.player.superReady()
            this.showPlayHints()
        }
        this.hud.update()
        if (this.netSession) this.netSession.update(this.game.loop.delta)

        // Update lifebar.
        this.lifebar.setFrame(this.player.lives)

        if (currentLevel >= 7 && currentLevel <= 8)
        {
            if (this.player.canMove == true)
            {
                this.caradhrasSnow.tilePositionX += 1
                this.caradhrasSnow.tilePositionY -= 1
                this.caradhrasSnowSmall.tilePositionX += 0.5
                this.caradhrasSnowSmall.tilePositionY -= 0.5
            }
        }
    }

    // Count this stage's coins into the saved total, then run `done`.
    coinTally(done)
    {
        // Stages without coins (Moria act 1) just wait like before.
        if (this.coinIds.length == 0)
        {
            this.time.delayedCall(4000, done)
            return
        }
        runCoinTally(this, this.coinCount, this.sonic ? "RINGS" : "COINS", 156, done)
    }

    // "SONIC GOT THROUGH!": the "GOT THROUGH!" part of Frodo's banner with
    // SONIC in big blue letters above it.
    sonicGotThrough()
    {
        let banner = this.add.container(config.width / 2, -100)
        let through = this.add.image(0, 0, "gotThrough", 0).setCrop(0, 38, 197, 16)
        let name = "SONIC"
        let x = -name.length * 16
        let shadow = new NesText(this, x + 3, -20, name, "#0000a8").setScale(4)
        let letters = new NesText(this, x, -23, name, "#3c7cfc").setScale(4)
        banner.add([shadow, letters, through])
        return banner
    }

    finishLevel()
    {
        // Level finish "got through".
        let finishSprite
        if (this.sonic)
        {
            finishSprite = this.sonicGotThrough()
        }
        else if (currentLevel < 9)
        {
            finishSprite = this.add.sprite(config.width/2, -100, "gotThrough", 0)
        }
        else
        {
            finishSprite = this.add.sprite(config.width/2, -100, "gotThrough", 1)
        }
        finishSprite.setScrollFactor(0, 0)
        finishSprite.setDepth(3)

        let finishTween = this.tweens.add({
            targets: finishSprite,
            y: {from: -100, to: config.height/2},
            ease: 'Bounce.easeOut',
            duration: 2000,
            repeat: 0,
            yoyo: false
        })

        // Count this stage's coins into the total, then fade out.
        finishTween.on("complete", function(tween, targets) {
            this.coinTally(() => this.cameras.main.fadeOut(1000))
        }, this)

        this.cameras.main.once('camerafadeoutcomplete', function (camera) {
            Progress.clear(currentLevel)

            // A full charge comes along to the next stage. Stages where it
            // can't be used (the horse ride) pass it on untouched.
            if (this.player.canSuper())
            {
                carriedCharge = this.player.superReady() ? SUPER_CHARGE_MAX : 0
            }

            if (this.online == "coop")
            {
                // Online co-op: on to the next stage together (skipping the
                // horse ride), and back to the room after Moria.
                if (currentLevel >= 9) { Net.inGame = false; this.scene.start("Online"); return }
                currentLevel = (currentLevel + 1 == 6) ? 7 : currentLevel + 1
                this.scene.restart()
            }
            else if (currentLevel < 9)
            {
                currentLevel += 1
                this.scene.restart()
            }
            else
            {
                this.scene.start("Balrog")
            }
        }, this)
    }
}

