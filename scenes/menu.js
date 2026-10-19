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

        this.load.audio("menu", "assets/music/khazadDum.mp3")
    }

    create()
    {
		this.menuPlaying = false
		this.cutscenePlaying = true

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

		this.cutscene.destroy()
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

        this.backgrounds = [
            this.add.tileSprite(0, 0, 0, 0, "hobbitonMountains"),
            this.add.tileSprite(0, 0, 0, 0, "hobbitonClouds")
        ]

        this.backgrounds[0].setOrigin(0, 0)
        this.backgrounds[0].setScrollFactor(0)

        this.backgrounds[1].setOrigin(0, 0)
        this.backgrounds[1].setScrollFactor(0)

        this.logo = this.add.image(config.width/2, 100, "logo")

        this.playButton = new Button(this, config.width/2, 180, 0, function playAction(scene)
        {
            scene.leaveTo("Level")
        })

        this.creditsButton = new Button(this, config.width/2, 207, 4, function creditsAction(scene)
        {
            scene.leaveTo("Credits")
        })

        // Keyboard / gamepad selection. The mouse hovering a button selects it too.
        this.buttons = [this.playButton, this.creditsButton]
        this.buttons.forEach((b, i) => b.onHover = () => this.select(i))
        this.select(0)

        Hints.show([
            {action: "navigate", label: "SELECT"},
            {action: "confirm", label: "OK"}
        ])
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
            this.backgrounds[1].tilePositionX += 2
            this.backgrounds[0].tilePositionX += 1

            if (!this.fadeStarted && this.time.now >= this.acceptInputAt)
            {
                let count = this.buttons.length
                if (GameInput.justPressed("down")) this.select((this.selected + 1) % count)
                if (GameInput.justPressed("up"))   this.select((this.selected + count - 1) % count)
                if (GameInput.justPressed("confirm")) this.buttons[this.selected].press()
            }
        }
    }
}
