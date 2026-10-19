const BALROG_BLUE = "#5182ff"
const BALROG_RED = "#db4161"

const BALROG_BRIEFING = [
    // The story.
    () => [
        {color: BALROG_BLUE, text: "Gandalf, the Balrog is Against you! Deflect it's lava projectiles with your magic staff!"},
        {color: "#ffffff", text: "By DEFLECTING a certain amount of Lava projectiles, you will enter a new phase. As the stage progresses, the game will get HARDER and HARDER..."},
        {color: "#ffffff", text: "If you don't deflect the lava projectile, you will lose a life. If you lose all five you get backtracked to the previous phase, so GOOD LUCK!"}
    ],

    // The controls, for the device in use.
    (mode) => (mode == "gamepad") ? [
        {color: BALROG_RED, text: "Use {LB} {RB} to look LEFT and RIGHT."},
        {color: BALROG_RED, text: "Aim the staff with {LS} and press {A} to DEFLECT the projectiles."},
        {color: BALROG_RED, text: "Pushing {LS} to the edge of the screen looks around too."}
    ] : [
        {color: BALROG_RED, text: "Use {A} {D} to look LEFT and RIGHT."},
        {color: BALROG_RED, text: "Aim the staff with {arrows} and press {S} to DEFLECT the projectiles."},
        {color: BALROG_RED, text: "Or use the mouse {mouse}: MOVE it to aim and CLICK to deflect."}
    ]
]

class Balrog extends Phaser.Scene
{
    constructor()
    {
        super({key: "Balrog"})
    }

    preload()
    {
        // Sounds.
        this.load.audio("balrogMusic", "assets/music/balrog.mp3")
        this.load.audio("fireBall", "assets/sounds/enemy.wav")
        this.load.audio("sword", "assets/sounds/sword.wav")

        // Backgrounds.
        this.load.image("moria3D", "assets/backgrounds/moria3D.png")
        this.load.image("moriaSkies", "assets/backgrounds/moriaSkies.png")
        this.load.image("moriaMountains", "assets/backgrounds/moriaMountains.png")
        this.load.image("moriaTombs", "assets/backgrounds/moriaTombs.png")

        // Sprites.
        this.load.image("moriaStaff", "assets/sprites/moriaStaff.png")
        this.load.image("balrog", "assets/sprites/balrog.png")
        this.load.spritesheet("bossHealthBar", "assets/sprites/bossHealthBar.png", {frameWidth: 42, frameHeight: 9})
        this.load.spritesheet("balrogProjectiles", "assets/sprites/balrogProjectiles.png", {frameWidth: 21, frameHeight: 21})
    }

    create()
    {
        this.cameras.main.fadeIn(500)
        let levelMusic = this.sound.add("balrogMusic", {loop: true}).play()

        // UI and GUI.
        this.started = false
        this.fading = false
        this.healthValue = 5
        this.phaseLevel = 1
        this.collectedFlames = 0
        addNesText(this, 10, 10, "HEALTH:", "#ffffff", false, true)
            .setScrollFactor(0, 0)
            .setDepth(1)
        this.healthBar = this.add.sprite(70, 10, "bossHealthBar", this.healthValue)
            .setScrollFactor(0, 0)
            .setOrigin(0, 0)
            .setDepth(1)
        this.phaseText = addNesText(this, 256 - 60, 10, "PHASE: " + this.phaseLevel, "#ffffff", false, true)
            .setScrollFactor(0, 0)
            .setDepth(1)

        // Briefing: the story first, then the controls for whatever is
        // being used right now. Click, key or button turns the page.
        this.briefing = new Briefing(this, BALROG_BRIEFING, ["NEXT", "START"], () => this.startFight())
        this.input.on('pointerdown', () => { if (!this.started) this.briefing.next() })

        this.startFight = () =>
        {
            if (this.started || this.fading) return
            this.started = true
            this.briefing.destroy()

            Hints.show([
                {action: "aim", label: "AIM"},
                {action: "strike", label: "STRIKE"},
                {action: "pan", label: "LOOK"},
                {action: "pause", label: "PAUSE", top: true}
            ])
        }

        // Player. Aim with the mouse, or with arrows / the left stick.
        this.keys = {
            pointer: this.input.activePointer
        }
        this.aim = {x: config.width/2, y: config.height/2}
        this.aimWithMouse = true
        this.input.on('pointermove', () =>
        {
            this.aimWithMouse = true
            this.aim.x = this.keys.pointer.x
            this.aim.y = this.keys.pointer.y
        })

        // Crosshair, shown when not aiming with the mouse.
        this.reticle = this.add.graphics()
            .lineStyle(1, 0xffffff, 1)
            .strokeCircle(0, 0, 5)
            .lineBetween(-8, 0, -3, 0).lineBetween(3, 0, 8, 0)
            .lineBetween(0, -8, 0, -3).lineBetween(0, 3, 0, 8)
            .setScrollFactor(0, 0)
            .setDepth(2)
            .setVisible(false)

        this.flames = []
        this.playerCamera = {x: 350, y: config.height/2}
        this.cameras.main.startFollow(this.playerCamera, true, 0.2, 1)

        // Parallax.
        this.add.image(config.width/2, config.height/2, "moriaSkies").setScrollFactor(0).setDepth(-1)
        createParallax(this, config.width * 5, "moriaTombs", 0.25)
        createParallax(this, config.width * 5, "moriaMountains", 0.5)
        this.add.image(0, 0, "moria3D").setOrigin(0, 0)

        // Staff.
        this.moriaStaff = this.add.image(config.width/2, config.height/2, "moriaStaff")
            .setScrollFactor(0, 0)
            .setDepth(1)

        // Balrog.
        let balrog = this.add.image(345, 80, "balrog")
            .setDepth(-1)
        let balrogTween = this.tweens.add({
            targets: balrog,
            y: 100,
            ease: 'linear',
            duration: 1500,
            repeat: -1,
            yoyo: true,
        });

        // Generate Projectiles.
        this.projectileTimer = this.time.addEvent({
            delay: 6000,
            callback: function(){
                if (this.started)
                {
                    this.sound.play("fireBall")

                    // Generate a random position.
                    let randomX = this.getRndInteger(150, 537)
                    let randomY = this.getRndInteger(80, 204)

                    let sprite = this.add.sprite(344, 46, "balrogProjectiles")
                        .setOrigin(0, 0)
                        .setInteractive({cursor: 'pointer'})
                    sprite.displayWidth = 0
                    sprite.displayHeight = 0

                    let clicked = false
                    sprite.collect = () =>
                    {
                        if (clicked) return
                        clicked = true
                        this.collectedFlames += 1
                        this.sound.play("sword")
                        sprite.destroy()
                    }
                    sprite.on('pointerdown', sprite.collect, this);
                    sprite.on('destroy', () => Phaser.Utils.Array.Remove(this.flames, sprite))
                    this.flames.push(sprite)

                    // Size and position tween.
                    let sizePosTween = this.tweens.add({
                        targets: sprite,
                        x: randomX,
                        y: randomY,
                        displayWidth: sprite.width * (randomY / 100),
                        displayHeight: sprite.height * (randomY / 100),
                        ease: 'Back.easeOut',
                        duration: 1000,
                    })

                    // Disappear tween.
                    let disappearTween = this.tweens.add({
                        targets: sprite,
                        alpha: {
                            getStart: () => 1,
                            getEnd: () => 0
                        },
                        onComplete: function () {
                            if (!clicked)
                            {
                                sprite.destroy()
                                this.healthValue -= 1
                                this.healthBar.setFrame(this.healthValue)
                            }
                        },
                        onCompleteScope: this,
                        ease: 'linear',
                        duration: 7000,
                    })
                }
            },
            callbackScope: this,
            loop: true
        });
    }

    update(time, delta)
    {
        if (!this.started)
        {
            if (GameInput.justPressed("confirm")) this.briefing.next()
        }
        else if (!this.fading && GameInput.justPressed("pause"))
        {
            Pause.open(this)
            return
        }

        if (this.started)
        {
            this.projectileTimer.delay = 6000 / this.phaseLevel

            if (this.healthValue <= 0)
            {
                this.healthValue = 5
                this.healthBar.setFrame(this.healthValue)
                if (this.phaseLevel > 1) {this.phaseLevel -= 1}
                this.phaseText.setText("PHASE: " + this.phaseLevel)
            }

            if (this.collectedFlames >= this.phaseLevel * 5)
            {
                this.collectedFlames = 0
                this.phaseLevel += 1
                this.phaseText.setText("PHASE: " + this.phaseLevel)
            }

            // Aim with arrows / left stick.
            let stick = GameInput.stick()
            if (stick.x != 0 || stick.y != 0)
            {
                this.aimWithMouse = false
                this.aim.x = Phaser.Math.Clamp(this.aim.x + stick.x * 4, 0, config.width)
                this.aim.y = Phaser.Math.Clamp(this.aim.y + stick.y * 4, 40, config.height)
            }

            // Player camera horizontal movement. Pushing the aim against the
            // screen edge also looks around.
            let edge = !this.aimWithMouse && stick.x != 0 &&
                (this.aim.x <= 0 || this.aim.x >= config.width)
            if (GameInput.isDown("panLeft") || (edge && stick.x < 0))
            {
                if (this.playerCamera.x >= 217)
                {
                    this.playerCamera.x -= 3
                }
            }
            else if (GameInput.isDown("panRight") || (edge && stick.x > 0))
            {
                if (this.playerCamera.x <= 475)
                {
                    this.playerCamera.x += 3
                }
            }

            // Move Staff. The hands image is screen-sized and centered, so
            // it can't go higher than this or the bottom of the arms shows.
            let staffMinY = config.height - this.moriaStaff.height / 2
            this.moriaStaff.y = Math.max(this.aim.y, staffMinY)
            this.moriaStaff.x = this.aim.x

            this.reticle.setPosition(this.aim.x, this.aim.y)
            this.reticle.setVisible(!this.aimWithMouse)

            // Strike the flames under the crosshair.
            if (GameInput.justPressed("strike"))
            {
                let point = this.cameras.main.getWorldPoint(this.aim.x, this.aim.y)
                this.flames.slice().forEach(flame =>
                {
                    let bounds = flame.getBounds()
                    Phaser.Geom.Rectangle.Inflate(bounds, 4, 4)
                    if (bounds.contains(point.x, point.y)) flame.collect()
                })
            }

            if (this.phaseLevel >= 10)
            {
                this.started = false
                this.reticle.setVisible(false)
                Hints.hide()
                this.moriaStaff.x = config.width/2
                this.moriaStaff.y = config.height/2
                if (!this.fading)
                {
                    this.finishLevel()
                }
            }

            // Print mouse position on the world.
            // console.log(this.playerCamera.x + " " + this.playerCamera.y)
        }
    }

    getRndInteger(min, max) 
    {
        return Math.floor(Math.random() * (max - min) ) + min;
    }

    finishLevel()
    {
        this.fading = true
            
        this.cameras.main.fadeOut(2000, 255, 255, 255)

        this.cameras.main.once('camerafadeoutcomplete', function (camera) {
            this.sound.stopAll()
            this.scene.start("Credits");
        }, this)
    }
}


  