// Enemy hits needed to fill the super charge.
const SUPER_CHARGE_MAX = 12

class Player extends Phaser.Physics.Arcade.Sprite
{
    constructor(scene, x, y, sprite)
    {
        super(scene, x, y, "frodo")

        // Add to updatelist.
        scene.add.existing(this)
        scene.physics.add.existing(this)
		this.sprite = sprite
		// Sprite keys can have an online color suffix ("frodo_3", "sonicSheet_2").
		this.isSonic = sprite.startsWith("sonicSheet") // Bought in the Shop.
		this.isFrodo = sprite.startsWith("frodo")

        let playerAnimations = this.isSonic ? this.createSonicAnims() : [
            this.anims.create ({
                key: "idle",
                frames: [{key: sprite, frame: 0}],
                frameRate: 7,
            }),

            this.anims.create ({
                key: "walking",
                frames: this.anims.generateFrameNumbers(sprite, {start: 1, end: 3}),
                frameRate: 7,
                repeat: -1
            }),

            this.anims.create({
                key: "attacking",
                frames: this.anims.generateFrameNumbers(sprite, {start: 4, end: 5}),
                frameRate: 5,
                repeat: -1
            }),

            this.anims.create({
                key: "falling",
                frames: [{key: sprite, frame: 6}],
                frameRate: 7,
            }),

            this.anims.create({
                key: "jumping",
                frames: [{key: sprite, frame: 7}],
                frameRate: 7,
            }),

            this.anims.create({
                key: "walkingAttacking",
                frames: this.anims.generateFrameNumbers(sprite, {start: 8, end: 10}),
                frameRate: 7,
            }),
			
			this.anims.create({
				key: "legolasHorseIdle",
				frames: [{key: "legolasHorse", frame: 1}],
				frameRate: 10,
			}),
			
			this.anims.create({
				key: "legolasHorseWalking",
				frames: this.anims.generateFrameNumbers("legolasHorse", {start: 0, end: 3}),
				frameRate: 10,
			})
        ]
        this.depth = 1
        this.canMove = false

        // Check if it isn't horse level.
		if (currentLevel != 6)
		{
			this.play('idle')
			this.body.setSize(this.width - 20, this.height)
		}
		else
		{
			this.play('legolasHorseWalking')
			this.body.setSize(this.width - 20, this.height)
			this.setOrigin(0.5, 1)
		}
		
		this.body.setGravityY(300)
		this.setMaxVelocity(500, 500)
		if (this.isSonic) this.setupSonic()
        scene.cameras.main.startFollow(this, true, 0.2, 1)

        // Recent positions (one per frame) and whether a jump started there,
        // which the AI companions follow.
        this.trail = []
        this.jumpedThisFrame = false

        // Set when the level starts, so the button that skipped the
        // titlecard doesn't also make the player jump.
        this.waitJumpRelease = false

        // Keyboard or gamepad, whichever was used last.
        this.controls = {
            left:   {get isDown() { return GameInput.isDown("left") }},
            right:  {get isDown() { return GameInput.isDown("right") }},
            jump:   {get isDown() { return GameInput.isDown("jump") }},
            attack: {get isDown() { return GameInput.isDown("attack") }}
        }

        // Hurt Timer.
        this.timer = {}
        this.timer.max = 100
        this.timer.current = 0
        this.timer.execute = true
        this.timer.tween = scene.add.tween({
            paused: true,
            targets: this,
            ease: 'Power0',
            duration: 500,
            delay: 0,
            alpha: {
              getStart: () => 1,
              getEnd: () => 0.5
            },

            repeat: 0,
            yoyo: true
        })
        this.fading = false
        this.lives = 4

        // Projectiles
        this.projectileCounter = 0
        this.projectileGroup = scene.physics.add.group()

        // Super charge: filled by hitting enemies, spent on a mega slash.
        this.charge = 0
        this.superGroup = scene.physics.add.group()
		
		// Enemy projectiles.
		scene.physics.add.overlap(this, scene.enemyProjectiles, function(_this, _projectile)
        {
            // Sonic curled up knocks them away instead.
            if (_this.isSonic && _this.isBall)
            {
                _this.scene.sound.play("sword")
            }
            else
            {
                _this.hurt()
            }
			_projectile.destroy()
        }, null, this)
		
		// Keys;
		this.keys = {
			red: false,
			yellow: false
		}
    }

    // Only Frodo on foot can attack (not Legolas' horse, not Gandalf).
    canSuper() {
        return this.isFrodo && currentLevel != 6
    }

    superReady() {
        return this.canSuper() && this.charge >= SUPER_CHARGE_MAX
    }

    // Called when one of our sword shots damages an enemy.
    addCharge(amount) {
        if (!this.canSuper()) return
        this.charge = Math.min(SUPER_CHARGE_MAX, this.charge + amount)
    }

    megaSlash() {
        this.charge = 0
        this.superGroup.add(new MegaSlash(this.scene, this.x, this.y, this.flipX))
        if (this.scene.netSession) this.scene.netSession.sendShot(this.x, this.y, this.flipX, true)
        this.scene.sound.play("sword")
        this.scene.cameras.main.flash(120, 255, 255, 255)
    }

    // Bounced up by a spring.
    springLaunch() {
        if (this.isSonic) this.sonicSpring()
        else this.setVelocityY(-250)
    }

    // `by`: the online player who hit us (deathmatch), `amount`: lives lost.
    hurt(by, amount) {
        // Nothing can hurt you once you've reached the end of the level.
        if (this.scene.levelFinished) return

        let net = this.scene.netSession
        if (net && (net.dead || net.over)) return

        // Sonic has rings instead of lives (not in deathmatch: fair fights).
        if (this.isSonic && !(net && net.mode == "deathmatch")) return this.sonicHurt()

        if (this.timer.execute) {
            this.scene.cameras.main.shake(100, 0.007);
            this.scene.sound.play("bump")
            this.lives -= (amount || 1) // Remove a life.
            this.lastHitBy = by || null

            this.timer.execute = false
            this.timer.current = this.timer.max
        } 
    }

    preUpdate(time, delta)
    {
        super.preUpdate(time, delta)

        if (this.waitJumpRelease && !this.controls.jump.isDown)
        {
            this.waitJumpRelease = false
        }

        if (this.canMove && this.isSonic)
        {
            this.sonicMove(delta)
        }
        else if (this.canMove)
        {
			if (currentLevel != 6)
			{
				// ### NORMAL WALKING. ###
				if (this.controls.left.isDown)
				{
					this.setVelocityX(-130)

					if (this.controls.attack.isDown)
					{
						this.play("walkingAttacking", true)
					}
					else
					{
						this.play('walking', true)
					}
					
					this.flipX = true
				}
				else if (this.controls.right.isDown)
				{
					this.setVelocityX(130)
					if (this.controls.attack.isDown)
					{
						this.play("walkingAttacking", true)
					}
					else
					{
						this.play('walking', true)
					}
					this.flipX = false
				}
				else
				{
					this.setVelocityX(0)

					if (this.controls.attack.isDown)
					{
						this.play("attacking", true)
					}
					else
					{
						this.play('idle', true)
					}
				}
				
				if (this.controls.jump.isDown && !this.waitJumpRelease && this.body.onFloor())
				{
					this.setVelocityY(-170)
					this.scene.sound.play("jump")
					this.jumpedThisFrame = true
				}
				
				// Jumping animation.
				if (this.body.velocity.y < 0) {
					this.play("jumping", true)
				} else if (this.body.velocity.y > 0) {
					this.play("falling", true)
				}
				
				// Shoot projectiles.
				if (this.isFrodo)
				{
					if(this.controls.attack.isDown && this.projectileCounter >= 15)    
					{
						this.projectileGroup.add(new Projectile(this.scene, this.x, this.y, this.flipX, "playerProjectile", 160, 30))
						if (this.scene.netSession) this.scene.netSession.sendShot(this.x, this.y, this.flipX, false)
						this.scene.sound.play("sword")
						this.projectileCounter = 0;
					}
					else 
					{
						this.projectileCounter++
					}

					if (this.superReady() && GameInput.justPressed("super"))
					{
						this.megaSlash()
					}
				}
			}
			else
			{
				// ### HORSE WALKING. ###
				if (this.controls.left.isDown)
				{
					if (this.body.velocity.y < 0) 
					{
						this.setVelocityX(-190)
						this.play("legolasHorseWalking", true)
					}
					else
					{
						this.setVelocityX(0)
						this.play("legolasHorseIdle", true)
					}
					//console.log("aaaaa")
				}
				else if (this.controls.right.isDown)
				{
					//
				}
				else
				{
					this.play("legolasHorseWalking", true)
					this.setVelocityX(150)
				}
				
				if (this.controls.jump.isDown && !this.waitJumpRelease && this.body.onFloor())
				{
					this.setVelocityY(-190)
					this.scene.sound.play("jump")
					this.jumpedThisFrame = true
				}
			}
        }

        // Update timer.
        if (this.timer.current > 0) {
            this.timer.current -= 1
            this.timer.tween.play()
            this.timer.paused = false
        }

        // If the timer is zero, you can
        // execute.
        if (this.timer.current == 0) {
            this.timer.execute = true
        }

        // Remember where we've been, for the companions to follow.
        this.trail.push({x: this.x, y: this.y, jumped: this.jumpedThisFrame})
        if (this.trail.length > 240) this.trail.shift()
        this.jumpedThisFrame = false

        // Restart level with a fade out.
        if (this.lives <= 0 && !this.scene.levelFinished) {
            if (!this.fading && this.scene.netSession) {
                // Online: no restart; drop out and come back (see NetSession).
                this.fading = true
                this.canMove = false
                this.setVelocityX(0)
                this.scene.netSession.localDied()
            }
            else if (!this.fading) {
                // No more control while dying.
                this.canMove = false
                this.setVelocityX(0)
                this.play(currentLevel == 6 ? "legolasHorseIdle" : "idle", true)

                // Slow death fade (lasts 1.5s, see FADE_SPEED).
                this.scene.cameras.main.fadeOut(4500, 180, 32, 42)
                this.scene.cameras.main.once('camerafadeoutcomplete', function (camera) {
                    carriedCharge = 0 // Dying loses a carried super charge.
                    this.scene.sound.stopAll()
                    this.scene.scene.restart()
                })
                this.fading = true
            }
        }
    }
}