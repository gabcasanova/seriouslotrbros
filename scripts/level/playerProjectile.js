class Projectile extends Phaser.Physics.Arcade.Sprite
{
    constructor(scene, x, y, goingLeft, projectileSprite, projectileVeloctity, projectileDuration)
    {
        super(scene, x, y, projectileSprite)

        // Add to updatelist.
        scene.add.existing(this)
        scene.physics.add.existing(this)
        
        this.goingLeft = goingLeft
        this.flipX = this.goingLeft
        this.projectileVelocity = projectileVeloctity
        this.projectileDuration = projectileDuration
        this.setDepth(3)
    }

    preUpdate(time, delta)
    {
        super.preUpdate(time, delta)

        this.projectileDuration--

        if (this.goingLeft)
        {
            this.setVelocityX(-this.projectileVelocity)
        }
        else
        {
            this.setVelocityX(this.projectileVelocity)
        }

        if (this.projectileDuration <= 0)
        {
            this.destroy()
        }
    }
}

// The super charge: a big piercing sword wave. Goes through enemies,
// hurting each one once, and flashes between gold and white.
class MegaSlash extends Projectile
{
    constructor(scene, x, y, goingLeft)
    {
        super(scene, x, y, goingLeft, "playerProjectile", 320, 75)

        this.setScale(2, 2.5)
        this.hits = new Set()
        this.damage = 5     // Regular enemies have 4 health at most.
        this.bossDamage = 6 // The Black Rider has 10 per phase.
        this.flashTimer = 0
    }

    // Damage `enemy` the first time this wave touches it. Returns true if so.
    hit(enemy)
    {
        if (this.hits.has(enemy)) return false
        this.hits.add(enemy)
        this.scene.cameras.main.shake(80, 0.006)
        return true
    }

    preUpdate(time, delta)
    {
        super.preUpdate(time, delta)

        if (!this.active) return
        this.flashTimer++
        this.setTintFill((Math.floor(this.flashTimer / 3) % 2) ? 0xffffff : 0xf8b800)
    }
}
