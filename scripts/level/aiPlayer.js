const AI_SPEED = 130          // Same as the player.
const AI_CATCH_UP_SPEED = 170

class AiPlayer extends Phaser.Physics.Arcade.Sprite
{
    constructor(scene, x, y, sprite, distance)
    {
        super(scene, x, y, sprite)

        scene.hasAiPlayer = true

        // Add to updatelist.
        scene.add.existing(this)
        scene.physics.add.existing(this)

        let aiAnimations = [
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
        ]

        this.body.setGravityY(300)
        this.body.setSize(this.width - 20, this.height)
        this.setCollideWorldBounds(true) // Stage edges are solid (see Level).
        this.distance = distance

        // Follows the player's path this many frames behind (the further
        // back in the party, the later), Sonic & Tails style.
        this.delay = Math.round(distance / AI_SPEED * 60)
        this.stuckTime = 0
        this.lastX = x

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
		
		this.fuckedSprite = scene.add.image(this.x, this.y, "aiFucked")
		this.fuckedSprite.visible = false
		this.lockStarted = false
		this.fuckedTimer = scene.time.addEvent({
			delay: 3500,
			callback: function(){
				this.fuckedSprite.visible = false
				},
			args: [],
			callbackScope: this,
			loop: false,
			repeat: 0,
			startAt: 0,
			timeScale: 1,
			paused: true
		});
    }

    // Walk along the player's trail, jumping where they jumped.
    follow(delta)
    {
        let player = this.scene.player
        let trail = player.trail
        let target = trail[Math.max(0, trail.length - 1 - this.delay)] || player
        let onFloor = this.body.onFloor()

        let toPlayer = player.x - this.x
        let dx = target.x - this.x
        let close = Math.abs(toPlayer) <= this.distance && Math.abs(player.y - this.y) < 40

        // Hang back next to the player instead of walking into them.
        if (close && onFloor)
        {
            this.setVelocityX(0)
            this.play("idle", true)
            this.flipX = toPlayer < 0
        }
        else if (Math.abs(dx) > 3)
        {
            // Run faster to catch up when left behind.
            let far = Math.abs(toPlayer) > this.distance + 80
            // Keep up with a fast player too (Sonic).
            let catchUp = Math.max(AI_CATCH_UP_SPEED, Math.abs(player.body.velocity.x) + 20)
            this.setVelocityX(Math.sign(dx) * (far ? catchUp : AI_SPEED))
            this.play("walking", true)
            this.flipX = dx < 0
        }
        else
        {
            this.setVelocityX(0)
            this.play("idle", true)
        }

        if (onFloor)
        {
            // Jump where the player jumped, over walls in the way, and up to
            // the player's path when it's above.
            let jumpedHere = trail.slice(Math.max(0, trail.length - 1 - this.delay - 4), trail.length - this.delay + 4)
                .some(p => p.jumped && Math.abs(p.x - this.x) < 20)
            let blocked = this.body.blocked.left || this.body.blocked.right
            let pathAbove = target.y < this.y - 24 && Math.abs(dx) < 48

            if (jumpedHere || (blocked && !close) || pathAbove)
            {
                this.setVelocityY(-170)
            }
        }

        // Lost (fell somewhere, stuck behind a wall, or far off screen):
        // drop back in from above the player, like the old respawn.
        let moving = Math.abs(this.x - this.lastX) > 0.5
        this.lastX = this.x
        this.stuckTime = (!close && !moving) ? this.stuckTime + delta : 0

        let lost = Math.abs(toPlayer) > 320 || this.y - player.y > 160
        if (lost || this.stuckTime > 1200)
        {
            this.stuckTime = 0
            let cam = this.scene.cameras.main
            this.setPosition(player.x - (player.flipX ? -1 : 1) * Math.min(this.distance, 40), cam.scrollY - 40)
            this.setVelocity(0, 0)
        }
    }

    hurt() {
        if (this.timer.execute) {
            this.lives -= 1 // Remove a life.
            this.timer.execute = false
            this.timer.current = this.timer.max
        } 
    }

    preUpdate(time, delta)
    {
        super.preUpdate(time, delta)
		
		this.fuckedSprite.x = this.x + 35
		this.fuckedSprite.y = this.y - 30
		
		if (this.scene.cameraLock)
		{
			if (!this.lockStarted)
			{
				this.fuckedSprite.visible = true
				this.fuckedTimer.paused = false
				this.lockStarted = true
			}
		}

        if (!this.fading) this.follow(delta)

        // Jumping animation.
        if (this.body.velocity.y < 0) {
            this.play("jumping", true)
        } else if (this.body.velocity.y > 0) {
            this.play("falling", true)
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

        // Restart level with a fade out.
        if (this.lives <= 0) {
            if (!this.fading) {
                this.anims.stop()

                // Make sprite red.
                let redTween = this.scene.tweens.add({
                    targets: this,
                    tint: {from: 0xFFFFFF, to: 0xFF0000},
                    ease: 'bounce.easeOut',
                    duration: 300,
                    repeat: 0,
                    yoyo: false
                })

                redTween.on('complete', function(tween, targets){
                    this.y = -300
                    this.x = this.scene.player.x
                    this.lives = 4
                    this.fading = false
                    this.tint = 0xFFFFFF
                }, this);

                this.fading = true
            }
        }
    }
}