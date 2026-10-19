class Menu extends Phaser.Scene
{
    constructor()
    {
        super({key: "Menu"})
    }

    preload()
    {
        this.load.image("hobbitonClouds", "assets/backgrounds/hobbitonClouds.png")
        this.load.image("hobbitonMountains", "assets/backgrounds/hobbitonMountains.png")
        this.load.image("logo", "assets/sprites/logo.png")

        this.load.spritesheet("buttons", "assets/sprites/buttons.png", {frameWidth: 76, frameHeight: 24})
        this.load.spritesheet("items", "assets/sprites/items.png", {frameWidth: 16, frameHeight: 16})
        this.load.audio("cheat", "assets/sounds/life.wav")

        this.load.audio("menu", "assets/music/khazadDum.mp3")
    }

    create(data)
    {
		this.menuPlaying = false
		this.cutscenePlaying = true
		this.cutscene = null

		// Coming back from the level select: straight to the title.
		if (data && data.skipIntro)
		{
			this.cutscenePlaying = false
			this.menuPlaying = true
			this.createTitle()
			return
		}

		// Intro plays in the HTML layer at full resolution.
		this.cutscene = new Cutscene(this, "assets/cutscenes/intro.mp4", () => this.endCutscene()).play()
		this.input.setDefaultCursor('pointer')
		this.input.on('pointerdown', () => this.skipCutscene())

		Hints.show([{action: "skip", label: "SKIP"}])
    }

	// Fade out the intro early.
	skipCutscene()
	{
		if (!this.cutscenePlaying) return
		this.cutscenePlaying = false
		Hints.hide()

		this.cutscene.fadeOut(2000, () => this.endCutscene())
	}

	// Runs once, whether the intro ended by itself or was skipped.
	endCutscene()
	{
		if (this.menuPlaying) return
		this.cutscenePlaying = false
		this.menuPlaying = true

		if (this.cutscene) this.cutscene.destroy()
		this.input.setDefaultCursor('default')
		this.createTitle()
	}

    createTitle()
    {
        this.cameras.main.fadeIn(2000)

        this.fadeStarted = false

        // Ignore input for a moment, so a press meant to skip the intro
        // doesn't also pick a menu option.
        this.acceptInputAt = this.time.now + 500

        let menuMusic = this.sound.add("menu", {loop: true})
        menuMusic.play()

        // Scrolling layers (mountains, then clouds on top).
        this.backgrounds = [
            this.makeStrip("hobbitonMountains", 1),
            this.makeStrip("hobbitonClouds", 2)
        ]

        this.logo = this.add.image(config.width/2, 92, "logo")

        this.playButton = new Button(this, config.width/2, 164, 0, function playAction(scene)
        {
            currentLevel = 0
            carriedCharge = 0
            scene.leaveTo("Level")
        })

        this.levelsButton = new Button(this, config.width/2, 190, 6, function levelsAction(scene)
        {
            scene.leaveTo("LevelSelect")
        })

        this.creditsButton = new Button(this, config.width/2, 216, 4, function creditsAction(scene)
        {
            scene.leaveTo("Credits")
        })

        // Every coin ever collected, top-left.
        this.coinIcon = this.add.image(4, 6, "items", 1).setOrigin(0, 0)
        this.coinText = addNesText(this, 20, 10, String(CoinStore.total), "#ffffff", false, true)

        // Alt+Q: unlock every stage and get 1000 coins.
        let cheat = (e) =>
        {
            if (e.altKey && e.code == "KeyQ" && !this.fadeStarted)
            {
                e.preventDefault()
                this.welcomeCheater()
            }
        }
        window.addEventListener("keydown", cheat)
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener("keydown", cheat))

        // Music and sound effect switches, top-right.
        this.musicToggle = new SoundToggle(this, config.width - 42, 6, "music")
        this.sfxToggle = new SoundToggle(this, config.width - 22, 6, "sfx")

        // Keyboard / gamepad selection. The mouse hovering a button selects it too.
        // The three menu buttons come first, then the two switches.
        this.buttons = [this.playButton, this.levelsButton, this.creditsButton, this.musicToggle, this.sfxToggle]
        this.buttons.forEach((b, i) => b.onHover = () => this.select(i))
        this.select(0)

        Hints.show([
            {action: "navigate", label: "SELECT"},
            {action: "confirm", label: "OK"}
        ])
    }

    // A layer that scrolls left forever, made of plain images side by side.
    // (TileSprite resamples its texture smoothly, which blurs pixel art.)
    makeStrip(key, speed)
    {
        let width = this.textures.get(key).getSourceImage().width
        let count = Math.ceil(config.width / width) + 1
        let images = []
        for (let i = 0; i < count; i++)
        {
            images.push(this.add.image(i * width, 0, key).setOrigin(0, 0).setScrollFactor(0))
        }
        return {images: images, width: width, speed: speed, offset: 0}
    }

    scrollStrip(strip)
    {
        strip.offset = (strip.offset + strip.speed) % strip.width
        strip.images.forEach((image, i) => image.x = i * strip.width - strip.offset)
    }

    welcomeCheater()
    {
        Progress.unlockAll(LEVEL_SELECT.length)
        CoinStore.add(1000)
        this.coinText.setText(String(CoinStore.total))
        this.sound.play("cheat")

        // Message in an 8-bit window over the logo, for a few seconds.
        if (this.cheatMessage) this.cheatMessage.forEach(o => o.destroy())
        let text = "WELCOME, CHEATER!"
        let w = text.length * 8 + 24
        let x = Math.round((config.width - w) / 2)
        let y = 80
        this.cheatMessage = [
            drawWindow(this.add.graphics(), x, y, w, 24).setDepth(10),
            addNesText(this, config.width / 2, y + 8, text, "#ffffff", true).setDepth(10)
        ]
        let message = this.cheatMessage
        this.time.delayedCall(2500, () =>
        {
            message.forEach(o => o.destroy())
            if (this.cheatMessage == message) this.cheatMessage = null
        })
    }

    select(index)
    {
        this.selected = index
        this.buttons.forEach((b, i) => b.setSelected(i == index))
    }

    leaveTo(sceneKey)
    {
        if (this.fadeStarted) return
        this.fadeStarted = true
        Hints.hide()
        this.sound.stopAll()
        this.cameras.main.fadeOut(2000)
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(sceneKey))
    }

    update(time, delta)
    {
		if (this.cutscenePlaying && GameInput.justPressed("skip"))
		{
			this.skipCutscene()
		}

        if (this.menuPlaying)
        {
            this.backgrounds.forEach(strip => this.scrollStrip(strip))

            // Keep the switches and coins inside the visible corners.
            let left = Math.ceil(Overlay.visibleBounds().left)
            this.coinIcon.x = left + 4
            this.coinText.x = left + 19
            let right = Math.floor(Overlay.visibleBounds().right)
            this.sfxToggle.moveTo(right - 22, 6)
            this.musicToggle.moveTo(right - 42, 6)

            if (!this.fadeStarted && this.time.now >= this.acceptInputAt)
            {
                // Up from the top button reaches the switches; left/right
                // moves between them, down goes back to the buttons.
                let onSwitch = this.selected >= 3
                if (GameInput.justPressed("down")) this.select(onSwitch ? 0 : (this.selected + 1) % 3)
                if (GameInput.justPressed("up"))   this.select(onSwitch ? this.selected : (this.selected == 0 ? 3 : this.selected - 1))
                if (this.selected >= 3 && (GameInput.justPressed("left") || GameInput.justPressed("right")))
                {
                    this.select(this.selected == 3 ? 4 : 3)
                }
                if (GameInput.justPressed("confirm")) this.buttons[this.selected].press()
            }
        }
    }
}
