class Credits extends Phaser.Scene
{
    constructor()
    {
        super({key: "Credits"})
    }

    preload()
    {
        this.load.text("credits", "assets/credits.txt")
        this.load.audio("creditsMusic", "assets/music/credits.mp3")
    }

    create()
    {
        this.cameras.main.fadeIn(2000, 255, 255, 255)

        this.musicVolume = 1
        this.leaving = false
        this.music = this.sound.add("creditsMusic")
        // NES font, all caps (its lowercase letters are unreadable).
        let credits = this.cache.text.get("credits").split(/\r?\n/).map(line => line.trim()).join("\n").toUpperCase()
        this.text = new NesText(this, 0, config.height, credits, "#ffffff", false, 12)
        this.text.x = Math.round(config.width / 2 - this.text.width / 2)

        // Click, key or button skips: first the ending video, then the credits.
        this.input.setDefaultCursor('pointer')
        this.input.on('pointerdown', () => this.skip())

        // Play the ending video if it's the end of the game.
        if (currentLevel >= 9)
        {
            this.creditsRolling = false
            this.cutscene = new Cutscene(this, "assets/cutscenes/ending.mp4", () => this.rollCredits()).play()
        }
        else
        {
            this.rollCredits()
        }

        Hints.show([{action: "skip", label: "SKIP"}])
    }

    rollCredits()
    {
        if (this.creditsRolling) return
        if (this.cutscene) this.cutscene.destroy()
        this.creditsRolling = true
        this.music.play()
    }

    skip()
    {
        if (!this.creditsRolling)
        {
            this.rollCredits()
        }
        else
        {
            this.leave()
        }
    }

    // Fade back to the menu.
    leave()
    {
        if (this.leaving) return
        this.leaving = true
        Hints.hide()

        this.tweens.add({targets: this.music, volume: 0, duration: 1000})
        this.cameras.main.fadeOut(1000)
        this.cameras.main.once('camerafadeoutcomplete', () => this.backToMenu())
    }

    backToMenu()
    {
        this.sound.stopAll()
        this.sound.setVolume(1)
        this.input.setDefaultCursor('default')
        currentLevel = 0
        this.scene.start("Menu");
    }

    update(time, delta)
    {
        if (GameInput.justPressed("skip"))
        {
            this.skip()
        }

        if (this.creditsRolling && !this.leaving)
        {
            this.text.y -= 0.3

            // Fade out music.
            if (this.text.y < -this.text.height)
            {
                if (this.musicVolume > 0)
                {
                    this.musicVolume -= 0.003
                    this.sound.setVolume(this.musicVolume)
                }
                else
                {
                    this.backToMenu()
                }
            }
        }
    }
}
