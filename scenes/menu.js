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

		// Before the title: the PEGI rating, the intro, then a note about
		// controls. Click, key or button skips each one.
		this.sequence = [
			() => this.playVideo("assets/cutscenes/pegi67.mp4", true),
			() => this.playVideo("assets/cutscenes/intro.mp4", false),
			() => this.showControlsNote()
		]
		this.step = -1
		this.input.setDefaultCursor('pointer')
		this.input.on('pointerdown', () => this.skipCutscene())
		this.nextStep()
    }

	nextStep()
	{
		if (this.menuPlaying) return
		if (this.cutscene) this.cutscene.destroy()
		this.cutscene = null
		if (this.note) this.note.forEach(o => o.destroy())
		this.note = null

		this.step++
		if (this.step < this.sequence.length)
		{
			this.cutscenePlaying = true
			Hints.show([{action: "skip", label: "SKIP"}])
			this.sequence[this.step]()
		}
		else
		{
			this.endCutscene()
		}
	}

	// Moves on from step `step` (ignored if that step is already over).
	finishStep(step)
	{
		if (step == this.step) this.nextStep()
	}

	// Videos play in the HTML layer at full resolution; `framed` shows a
	// smaller one instead of filling the screen.
	playVideo(src, framed)
	{
		let step = this.step
		this.cutscene = new Cutscene(this, src, () => this.finishStep(step), framed).play()
	}

	showControlsNote()
	{
		let step = this.step
		let cx = config.width / 2
		let w = 200
		let x = Math.round(cx - w / 2)
		this.note = [
			drawWindow(this.add.graphics(), x, 96, w, 48),
			addNesText(this, cx, 108, "KEYBOARD AND GAMEPAD", "#f8b800", true),
			addNesText(this, cx, 124, "COMPATIBLE", "#ffffff", true)
		]
		this.cameras.main.fadeIn(1000)
		this.noteTimer = this.time.delayedCall(3000, () => this.fadeNote(step))
	}

	fadeNote(step)
	{
		if (step != this.step) return
		if (this.noteTimer) this.noteTimer.remove()
		this.cameras.main.fadeOut(1000)
		this.cameras.main.once('camerafadeoutcomplete', () => this.finishStep(step))
	}

	// Skips whatever is showing.
	skipCutscene()
	{
		if (!this.cutscenePlaying) return
		this.cutscenePlaying = false
		Hints.hide()

		let step = this.step
		if (this.cutscene) this.cutscene.fadeOut(2000, () => this.finishStep(step))
		else this.fadeNote(step)
	}

	// Runs once, after the last step.
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

        // Levels and Shop side by side.
        this.levelsButton = new Button(this, config.width/2 - 39, 190, 6, function levelsAction(scene)
        {
            scene.leaveTo("LevelSelect")
        })

        this.shopButton = new Button(this, config.width/2 + 39, 190, 8, function shopAction(scene)
        {
            scene.leaveTo("Shop")
        })

        // Online and Credits side by side.
        this.onlineButton = new Button(this, config.width/2 - 39, 216, 10, function onlineAction(scene)
        {
            scene.leaveTo("Online")
        })

        this.creditsButton = new Button(this, config.width/2 + 39, 216, 4, function creditsAction(scene)
        {
            scene.leaveTo("Credits")
        })

        // Credit line, top center.
        addNesText(this, config.width / 2, 6, "BY GABRIEL CASANOVA 2021, 2026", "#ffffff", true, true)
        addNesText(this, config.width / 2, 18, "NON-COMMERCIAL FAN PROJECT", "#bcbcbc", true, true)

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
        this.volumeControl = new VolumeControl(this, config.width - 6 - VOLUME_BAR_WIDTH, 6)

        // Keyboard / gamepad selection. The mouse hovering a button selects it too.
        // The three menu buttons come first, then the two switches.
        this.buttons = [this.playButton, this.levelsButton, this.creditsButton, this.volumeControl, this.shopButton, this.onlineButton]
        // Layout for keyboard / gamepad: rows of button indices, top to bottom.
        this.grid = [[3], [0], [1, 4], [5, 2]]
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

            // Keep the volume control and coins inside the visible corners.
            let left = Math.ceil(Overlay.visibleBounds().left)
            this.coinIcon.x = left + 4
            this.coinText.x = left + 19
            let right = Math.floor(Overlay.visibleBounds().right)
            this.volumeControl.moveTo(right - 6 - VOLUME_BAR_WIDTH, 6)

            if (!this.fadeStarted && this.time.now >= this.acceptInputAt)
            {
                // Move around the grid: up from New Game reaches the volume
                // control, down from Credits wraps to New Game.
                let r = this.grid.findIndex(row => row.includes(this.selected))
                let c = this.grid[r].indexOf(this.selected)
                let go = (row, col) => this.select(this.grid[row][Math.min(col, this.grid[row].length - 1)])
                if (GameInput.justPressed("down")) go(r == this.grid.length - 1 ? 1 : r + 1, c)
                else if (GameInput.justPressed("up")) go(Math.max(0, r - 1), c)
                else if (this.buttons[this.selected] == this.volumeControl)
                {
                    // Left/right turn the volume down/up.
                    if (GameInput.justPressed("left")) AudioSettings.step(-1)
                    if (GameInput.justPressed("right")) AudioSettings.step(1)
                }
                else if (GameInput.justPressed("left")) go(r, Math.max(0, c - 1))
                else if (GameInput.justPressed("right")) go(r, c + 1)
                if (GameInput.justPressed("confirm")) this.buttons[this.selected].press()
            }
        }
    }
}
