class BlackRider extends Phaser.Physics.Arcade.Sprite
{
	constructor(scene, x, y, firstX, lastX)
	{
		super(scene, x, y, "blackrider")
		
		// Add to updatelist.
        scene.add.existing(this)
        scene.physics.add.existing(this)
		
		this.body.setSize(this.width - 30, this.height)
		this.setOrigin(0.5, 1)
		
		// Animation
		this.anims.create ({
            key: "riderWalkingNormal",
            frames: this.anims.generateFrameNumbers("blackrider", {start: 0, end: 3}),
            frameRate: 7,
            repeat: -1
        }),
		
		this.anims.create ({
            key: "riderWalkingPinch",
            frames: this.anims.generateFrameNumbers("blackrider", {start: 0, end: 3}),
            frameRate: 14,
            repeat: -1
        }),
		
		this.started = false
		this.moving = false
		this.velocity  = 1.5
		this.pinchMode = false
		this.firstX = firstX
        this.lastX  = lastX
		this.flipX = false
		this.dead = false
		
		this.maxHealth = 10
		this.health = this.maxHealth
		
		if (currentLevel == 5)
		{
			this.totalPinches = 3
		}
		else
		{
			this.totalPinches = 5
		}
		
		this.movingTimer = scene.time.addEvent({
			delay: 4000,
			callback: function(){
				this.moving = true
				},
			args: [],
			callbackScope: this,
			loop: false,
			repeat: 0,
			startAt: 0,
			timeScale: 1,
			paused: true
		});
		
		// Destroy projectile and get hurt.
        scene.physics.add.overlap(this, scene.player.projectileGroup, function(_this, _projectile)
        {
			if (this.moving)
			{
				if (!this.pinchMode)
				{
					_projectile.destroy()
					scene.player.addCharge(1)
					this.health -= 1
					this.shareHit()
					this.scene.cameras.main.shake(50, 0.003)
				}
			}
        }, null, this)

		// Super charge: a big hit, under the same rules as normal hits.
        scene.physics.add.overlap(this, scene.player.superGroup, function(_this, slash)
        {
			if (this.moving && !this.pinchMode && slash.hit(this))
			{
				this.health -= slash.bossDamage
				this.shareHit()
			}
        }, null, this)
		
		// Hurt player.
        scene.physics.add.overlap(this, scene.player, function()
        {
			if (!this.dead && !scene.player.ballHit(this, 3))
			{
				scene.player.hurt()
			}
        }, null, this)
		
		this.healthBar = scene.add.sprite(this.x, this.y, "bossHealthBar", 0) // Healthbar sprite.
	}
	
	// Online co-op: everyone's Black Rider takes the same hits. The whole
	// state is sent (pinches left and health), not just the damage, so the
	// screens agree even when the players reach the fight at different times.
	shareHit()
	{
		this.checkPinch()
		if (this.scene.netSession) this.scene.netSession.shareRiderHit(this.totalPinches, this.health)
	}

	// Another player's hit: keep whichever state is further along.
	syncHealth(pinches, health)
	{
		if (this.dead) return
		if (pinches < this.totalPinches)
		{
			this.totalPinches = pinches
			this.health = health
			this.startPinch()
		}
		else if (pinches == this.totalPinches)
		{
			this.health = Math.min(this.health, health)
		}
	}

	// Out of health: lose a pinch and go red for a while.
	checkPinch()
	{
		if (this.pinchMode || this.health > 0) return
		this.totalPinches -= 1
		this.health = this.maxHealth
		this.startPinch()
	}

	startPinch()
	{
		this.pinchMode = true
		if (this.pinchTimer) this.pinchTimer.remove()
		this.pinchTimer = this.scene.time.delayedCall(10000, () => this.pinchMode = false)
	}

	// Sonic's ball or spindash: hurts under the same rules as sword hits.
	takeBallHit(damage)
	{
		if (this.moving && !this.pinchMode) { this.health -= damage; this.shareHit() }
	}

	preUpdate(time, delta)
	{
		super.preUpdate(time, delta)
		
		// Update healthbar.
		this.healthBar.x = this.x
		this.healthBar.y = this.y - this.height
		this.healthBar.setFrame(this.totalPinches)
		
		// Start boss.
		if (this.scene.cameraLock)
		{
			if (!this.started)
			{
				this.scene.sound.stopAll()
				this.scene.sound.play("bossMusic")
				this.body.setGravityY(300)
				this.started = true
				this.movingTimer.paused = false
			}
		}
		
		// Animate and move boss.
		if (this.moving)
		{	
			// Enemy walk.
			if (!this.pinchMode)
			{
				this.play("riderWalkingNormal", true)
				this.tint = 0xFFFFFF
				
				if (!this.flipX)
				{
					this.x -= this.velocity
				}
				else if (this.flipX)
				{
					this.x+= this.velocity
				}
			}
			else
			{
				this.play("riderWalkingPinch", true)
				this.tint = 0xFF0000
				
				if (!this.flipX)
				{
					this.x -= this.velocity * 1.7
				}
				else if (this.flipX)
				{
					this.x+= this.velocity * 1.7
				}
			}
			
		}
		
		// Change direction
        if (this.x <= this.firstX)
        {
			this.flipX = true
        }
        else if (this.x >= this.lastX)
        {
			this.flipX = false
        }
		
		// Start pinch mode.
		if (this.started) this.checkPinch()
		
		// Kill boss animation.
		if (!this.dead)
		{
			if (this.totalPinches <= 0)
			{
				this.pinchMode = false
				this.moving = false
				this.anims.stop()
				this.dead = true
				
				// Make sprite transparent.
				let transparentTween = this.scene.tweens.add({
                    targets: this,
                    alpha: {
                        getStart: () => 1,
                        getEnd: () => 0
                    },
                    ease: 'Bounce.easeOut',
                    duration: 5000,
                    repeat: 0,
                    yoyo: false
                })
				
				transparentTween.on("complete", function(tween, targets) {
					
					new Item(this.scene, this.x, this.y, "redKey", false)
					this.scene.cameraLock = false
					this.scene.cameras.main.startFollow(this.scene.player, true, 0.2, 1)
					this.scene.sound.stopAll()
					this.scene.sound.play("levelMusic")
					
					
					this.healthBar.destroy()
                    this.destroy()
                }, this)
			}
		}
	}
}