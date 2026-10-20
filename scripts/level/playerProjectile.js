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

// Pierre's shot: a blob of paint in a random paint color, which bursts
// into a splash when it hits something or runs out.
const PAINT_COLORS = [0xf83800, 0xf8b800, 0x58d854, 0x3cbcfc, 0xf878f8, 0x9878f8]

class PaintShot extends Projectile
{
    constructor(scene, x, y, goingLeft)
    {
        super(scene, x, y, goingLeft, "pierrePaint", 160, 30)
        paintAnims(scene)
        this.color = Phaser.Utils.Array.GetRandom(PAINT_COLORS)
        this.setTint(this.color)
        this.play("pierrePaint")

        // Not when the whole stage is closing.
        this.once(Phaser.GameObjects.Events.DESTROY, () =>
        {
            if (scene.sys.isActive()) paintSplash(scene, this.x, this.y, this.color)
        })
    }
}

// The paint blob (2 frames) and the splash (8 frames), made once.
function paintAnims(scene)
{
    if (scene.anims.exists("pierrePaint")) return
    scene.anims.create({key: "pierrePaint", frames: scene.anims.generateFrameNumbers("pierrePaint", {start: 0, end: 1}), frameRate: 12, repeat: -1})
    scene.anims.create({key: "pierreSplash", frames: scene.anims.generateFrameNumbers("pierreSplash", {start: 0, end: 7}), frameRate: 24})
    scene.anims.create({key: "pierreSuperPaint", frames: scene.anims.generateFrameNumbers("pierreSuperPaint", {start: 0, end: 1}), frameRate: 12, repeat: -1})
    scene.anims.create({key: "pierreSuperSplash", frames: scene.anims.generateFrameNumbers("pierreSuperSplash", {start: 0, end: 7}), frameRate: 24})
}

// A paint splash; `big` is the super's, from the bigger burst.
function paintSplash(scene, x, y, color, big)
{
    let key = big ? "pierreSuperSplash" : "pierreSplash"
    let splash = scene.add.sprite(Math.round(x), Math.round(y), key, 0)
        .setTint(color).setDepth(3)
    if (big) splash.setOrigin(45 / 90, 34 / 100)
    else splash.setOrigin(21 / 42, 16 / 46)
    splash.play(key)
    splash.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => splash.destroy())
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

// Pierre's super: a big blob of paint (the original Artius one, at its own
// size) that changes color as it flies, goes through enemies like the
// sword wave (splashing each one), and bursts into a big splash at the end.
class SuperPaint extends MegaSlash
{
    constructor(scene, x, y, goingLeft)
    {
        super(scene, x, y, goingLeft)
        paintAnims(scene)
        this.setScale(1)
        this.setTexture("pierreSuperPaint", 0)
        this.body.setSize(48, 24) // As big as the sword wave hits.
        this.play("pierreSuperPaint")
        this.colorIndex = Phaser.Math.Between(0, PAINT_COLORS.length - 1)
        this.setTint(PAINT_COLORS[this.colorIndex])

        this.once(Phaser.GameObjects.Events.DESTROY, () =>
        {
            if (scene.sys.isActive()) paintSplash(scene, this.x, this.y, PAINT_COLORS[this.colorIndex], true)
        })
    }

    hit(enemy)
    {
        if (!super.hit(enemy)) return false
        paintSplash(this.scene, enemy.x, enemy.y, PAINT_COLORS[this.colorIndex])
        return true
    }

    preUpdate(time, delta)
    {
        // The flying part only: no gold flashing like the sword wave.
        Projectile.prototype.preUpdate.call(this, time, delta)
        if (!this.active) return
        this.flashTimer++
        if (this.flashTimer % 4 == 0)
        {
            this.colorIndex = (this.colorIndex + 1) % PAINT_COLORS.length
            this.setTint(PAINT_COLORS[this.colorIndex])
        }
    }
}
