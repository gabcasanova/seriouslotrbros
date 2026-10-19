// Sonic the Hedgehog (a Shop item): replaces Frodo, with Genesis-style
// physics. The values are the Sonic 2 ones (in pixels per frame at 60fps)
// scaled by 0.75 to this game's smaller sprites, and turned into the
// pixels-per-second units Arcade Physics uses.
const SONIC_SCALE = 0.75
const sonicPx = (perFrame) => perFrame * SONIC_SCALE * 60 // Speed: px/frame -> px/s.
const SONIC = {
    acceleration: sonicPx(0.046875),  // Per frame, while holding a direction.
    deceleration: sonicPx(0.5),       // Per frame, holding against the motion.
    friction:     sonicPx(0.046875),  // Per frame, letting go.
    topSpeed:     sonicPx(6),
    airAcceleration: sonicPx(0.09375),
    gravity:      sonicPx(0.21875) * 60,
    jump:         sonicPx(6.5),
    jumpRelease:  sonicPx(4),         // Letting go of jump caps the rise at this.
    rollFriction: sonicPx(0.0234375),
    rollDeceleration: sonicPx(0.125),
    rollStop:     sonicPx(0.5),       // Rolling ends below this speed.
    spindash:     sonicPx(8),         // Plus sonicPx(0.5) per rev, up to 8 revs.
    bounce:       sonicPx(5),         // Off an enemy hit from above.
    spring:       sonicPx(10),        // Yellow spring launch.
    springHeld:   sonicPx(6.5)        // Launch when jump is held: a lower, controlled bounce.
}

Object.assign(Player.prototype, {

    createSonicAnims()
    {
        let f = SONIC_ANIM_FRAMES
        let frames = (list) => list.map(n => ({key: "sonicSheet", frame: n}))
        return [
            this.anims.create({key: "idle",     frames: frames(f.idle), frameRate: 1}),
            this.anims.create({key: "walking",  frames: frames(f.walk), frameRate: 10, repeat: -1}),
            this.anims.create({key: "running",  frames: frames(f.run),  frameRate: 16, repeat: -1}),
            this.anims.create({key: "ball",     frames: frames(f.ball), frameRate: 20, repeat: -1}),
            this.anims.create({key: "spindash", frames: frames(f.spindash.concat(f.ball[0])), frameRate: 20, repeat: -1}),
            this.anims.create({key: "crouch",   frames: frames(f.crouch), frameRate: 1}),
            this.anims.create({key: "skid",     frames: frames(f.skid), frameRate: 1}),
            this.anims.create({key: "hurt",     frames: frames(f.hurt), frameRate: 1})
        ]
    },

    setupSonic()
    {
        this.gsp = 0          // Ground speed, px/s, signed.
        this.jumping = false
        this.rolling = false
        this.spindashing = false
        this.revs = 0
        this.skidding = false
        this.isBall = false
        this.ballHits = new Map() // Enemy -> time it was last hit.

        this.body.setSize(14, 30)
        this.body.setOffset(9, 10)
        this.body.setGravityY(SONIC.gravity)
        this.setMaxVelocity(700, 700)
    },

    // Hit: drop the rings (they scatter and can be picked back up), or die
    // when there are none. Knocked back, with no control until he lands.
    sonicHurt()
    {
        if (!this.timer.execute) return // Still flashing from the last hit.
        this.timer.execute = false
        this.timer.current = this.timer.max

        let scene = this.scene
        scene.cameras.main.shake(100, 0.007)
        scene.sound.play("bump")

        let rings = scene.coinCount
        if (rings <= 0)
        {
            this.lives = 0
            return
        }
        scene.coinCount = 0
        scatterRings(scene, this.x, this.y, rings)

        let away = this.flipX ? 1 : -1
        this.gsp = away * sonicPx(2)
        this.setVelocity(this.gsp, -sonicPx(4))
        this.jumping = this.rolling = this.spindashing = this.isBall = false
        this.knockedBack = true
        this.knockedAt = scene.time.now
    },

    // Called instead of the normal controls when playing as Sonic.
    sonicMove(delta)
    {
        if (this.knockedBack)
        {
            let landed = this.body.onFloor() && this.scene.time.now - this.knockedAt > 150
            if (!landed)
            {
                this.play("hurt", true)
                return
            }
            this.knockedBack = false
            this.gsp = 0
        }

        let f = delta / (1000 / 60)
        let left = GameInput.isDown("left")
        let right = GameInput.isDown("right")
        let down = GameInput.isDown("down")
        let onFloor = this.body.onFloor()
        let gsp = this.gsp
        let sign = Math.sign(gsp)
        let toward = (amount) => gsp - sign * Math.min(Math.abs(gsp), amount * f)

        if (onFloor && this.jumping && this.body.velocity.y >= 0) this.jumping = false
        this.skidding = false

        if (onFloor && this.spindashing)
        {
            // Revving: each jump press adds speed; let go of down to dash.
            gsp = 0
            if (GameInput.justPressed("jump"))
            {
                this.revs = Math.min(8, this.revs + 1)
                this.scene.sound.play("sonicSpin")
            }
            if (!down)
            {
                this.scene.sound.play("sonicDash")
                this.launch(SONIC.spindash + this.revs * sonicPx(0.5))
                gsp = this.gsp
            }
        }
        else if (onFloor && this.rolling)
        {
            if ((left && gsp > 0) || (right && gsp < 0)) gsp = toward(SONIC.rollDeceleration)
            gsp = toward(SONIC.rollFriction)
            if (Math.abs(gsp) < SONIC.rollStop) this.rolling = false
        }
        else if (onFloor && down && Math.abs(gsp) < SONIC.rollStop)
        {
            // Crouch; jump while crouching starts a spindash.
            gsp = 0
            if (GameInput.justPressed("jump"))
            {
                this.spindashing = true
                this.revs = 0
                this.scene.sound.play("sonicSpin")
            }
        }
        else if (onFloor && down && Math.abs(gsp) >= SONIC.rollStop)
        {
            this.rolling = true // Duck while running to roll.
            this.scene.sound.play("sonicSpin")
        }
        else if (onFloor)
        {
            if (left)
            {
                if (gsp > 0) { gsp -= SONIC.deceleration * f; this.skidding = gsp > sonicPx(2) }
                else if (gsp > -SONIC.topSpeed) gsp = Math.max(gsp - SONIC.acceleration * f, -SONIC.topSpeed)
            }
            else if (right)
            {
                if (gsp < 0) { gsp += SONIC.deceleration * f; this.skidding = gsp < -sonicPx(2) }
                else if (gsp < SONIC.topSpeed) gsp = Math.min(gsp + SONIC.acceleration * f, SONIC.topSpeed)
            }
            else
            {
                gsp = toward(SONIC.friction)
            }
        }
        else
        {
            // In the air: steer, and a little air drag near the top of a jump.
            if (left && gsp > -SONIC.topSpeed) gsp = Math.max(gsp - SONIC.airAcceleration * f, -SONIC.topSpeed)
            if (right && gsp < SONIC.topSpeed) gsp = Math.min(gsp + SONIC.airAcceleration * f, SONIC.topSpeed)

            let vy = this.body.velocity.y
            if (vy < 0 && vy > -sonicPx(4)) gsp -= gsp / 32 * f

            // Short hop when jump is let go early.
            if (this.jumping && !GameInput.isDown("jump") && vy < -SONIC.jumpRelease)
            {
                this.setVelocityY(-SONIC.jumpRelease)
            }
        }

        // Jump (not while revving a spindash).
        if (onFloor && !this.spindashing && !(down && !this.rolling && Math.abs(gsp) < SONIC.rollStop) &&
            GameInput.justPressed("jump") && !this.waitJumpRelease)
        {
            this.setVelocityY(-SONIC.jump)
            this.jumping = true
            this.rolling = false
            this.scene.sound.play("sonicJump")
            this.jumpedThisFrame = true
        }

        // Walls stop him. Pushing into one keeps a little pressure on it, so
        // he stays touching it instead of flickering between idle and walking.
        if ((this.body.blocked.left && gsp < 0) || (this.body.blocked.right && gsp > 0)) gsp = 0
        this.pushing = onFloor && !this.isBall && ((left && this.body.blocked.left) || (right && this.body.blocked.right))
        if (this.pushing) gsp = 0

        this.gsp = gsp
        this.setVelocityX(this.pushing ? (left ? -20 : 20) : gsp)
        this.isBall = this.jumping || this.rolling || this.spindashing

        // Face where he's going (or where he's pushing).
        if (gsp < -1) this.flipX = !this.skidding
        else if (gsp > 1) this.flipX = this.skidding
        else if (left) this.flipX = true
        else if (right) this.flipX = false

        this.sonicAnimate(onFloor, down)
    },

    // Springs: a full launch, not cut short by letting go of jump.
    sonicSpring()
    {
        this.scene.sound.play("sonicSpring")
        this.setVelocityY(-(GameInput.isDown("jump") ? SONIC.springHeld : SONIC.spring))
        this.jumping = false
        this.rolling = false
        this.spindashing = false
    },

    launch(speed)
    {
        this.spindashing = false
        this.rolling = true
        this.gsp = (this.flipX ? -1 : 1) * speed
    },

    sonicAnimate(onFloor, down)
    {
        let speed = Math.abs(this.gsp)
        this.anims.timeScale = 1
        if (this.spindashing)
        {
            // Revving: the jump ball spinning in place, faster with each rev.
            this.play("ball", true)
            this.anims.timeScale = 1.5 + this.revs * 0.5
        }
        else if (this.isBall)
        {
            this.play("ball", true)
            this.anims.timeScale = Math.max(1, speed / sonicPx(4))
        }
        else if (!onFloor) this.play(speed > sonicPx(4.5) ? "running" : "walking", true)
        else if (this.skidding) this.play("skid", true)
        else if (down && speed < SONIC.rollStop) this.play("crouch", true)
        else if (this.pushing) this.play("idle", true)
        else if (speed > sonicPx(4.5)) this.play("running", true)
        else if (speed > 1)
        {
            this.play("walking", true)
            this.anims.timeScale = Math.max(0.5, speed / sonicPx(3))
        }
        else this.play("idle", true)
    },

    // Touching an enemy while curled up: hurts it instead of Sonic.
    // Returns true if it counted as a ball hit.
    ballHit(enemy, damage)
    {
        if (!this.isSonic || !this.isBall) return false

        let now = this.scene.time.now
        if ((this.ballHits.get(enemy) || 0) > now - 400) return true // Same hit.
        this.ballHits.set(enemy, now)

        enemy.takeBallHit(damage)
        this.scene.cameras.main.shake(60, 0.004)

        // Bounce off when coming down on it (a spindash cuts straight through).
        if (!this.onFloorNow() && this.body.velocity.y > 0)
        {
            this.setVelocityY(-SONIC.bounce)
            this.jumping = true
        }
        return true
    },

    onFloorNow()
    {
        return this.body.onFloor()
    }
})

// Lost rings: a few rings flung out in a fan, together worth `amount`.
// They bounce around and can be picked back up, then blink and vanish.
const RING_SCATTER_MAX = 8
const RING_LIFETIME = 8000
const RING_BLINK_TIME = 2000 // Blinks for this long before vanishing.

function scatterRings(scene, x, y, amount)
{
    let count = Phaser.Math.Clamp(Math.ceil(amount / 5), 1, Math.min(RING_SCATTER_MAX, amount))
    let base = Math.floor(amount / count)
    let extra = amount - base * count

    for (let i = 0; i < count; i++)
    {
        let value = base + (i < extra ? 1 : 0)
        let ring = scene.physics.add.sprite(x, y - 8, "ringSheet").play(ringAnimation(scene)).setDepth(2)
        ring.body.setSize(12, 14)
        ring.body.setGravityY(300)
        ring.setBounce(0.6, 0.6)
        ring.setDrag(10, 0)

        // Fan out upwards, alternating left and right, the outer ones lower.
        let side = (i % 2) ? 1 : -1
        let angle = Phaser.Math.DegToRad(-90 + side * (15 + Math.floor(i / 2) * 22))
        let speed = 180 + (i % 3) * 25
        ring.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)

        scene.physics.add.collider(ring, scene.layers[1])

        // Can't be caught again straight away.
        scene.time.delayedCall(500, () =>
        {
            if (!ring.active) return
            scene.physics.add.overlap(ring, scene.player, () =>
            {
                scene.coinCount += value
                scene.sound.play("ring")
                ring.destroy()
            })
        })

        // Blink for the last part, then go.
        scene.time.delayedCall(RING_LIFETIME - RING_BLINK_TIME, () =>
        {
            if (ring.active) scene.tweens.add({targets: ring, alpha: 0, duration: 90, yoyo: true, repeat: Math.floor(RING_BLINK_TIME / 180) - 1, ease: "Stepped"})
        })
        scene.time.delayedCall(RING_LIFETIME, () => { if (ring.active) ring.destroy() })
    }
}
