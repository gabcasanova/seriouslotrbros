// Mario Maker style drop shadows for everything in the level (tiles,
// characters, enemies, items), cast onto the backgrounds.
//
// The world is drawn into one render texture, offset by the shadow offset,
// and the whole texture is shown as a single flat color. So overlapping
// shadows don't get darker, and the shadow sits behind all of the level but
// in front of the parallax backgrounds.
//
// Open the game with ?shadows in the address to tune these live.
const SHADOW_DEFAULTS = {
    enabled: true,
    offsetX: 2,
    offsetY: 2,
    opacity: 0.4,
    color: "#000000",

    // What casts a shadow.
    backgroundTiles: true,
    terrain: true,
    foregroundTiles: true,
    characters: true,
    enemies: true,
    items: true,
    projectiles: true,
    other: true
}

const ShadowSettings = Object.assign({}, SHADOW_DEFAULTS)

class LevelShadows
{
    // tileLayers: [background, terrain, foreground] tilemap layers.
    constructor(scene, tileLayers)
    {
        this.scene = scene
        this.tileLayers = tileLayers

        this.texture = scene.add.renderTexture(0, 0, config.width, config.height)
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(-0.5) // Backgrounds are at -1, the level at 0 and up.

        // Draw once the camera has moved for this frame, or the shadows
        // trail a frame behind when it scrolls: the camera follows the player
        // in its own pre-render step, after the scene's PRE_RENDER event.
        let cam = scene.cameras.main
        cam.on(Phaser.Cameras.Scene2D.Events.FOLLOW_UPDATE, this.draw, this)
        scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.drawIfStill, this)
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        {
            cam.off(Phaser.Cameras.Scene2D.Events.FOLLOW_UPDATE, this.draw, this)
            scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.drawIfStill, this)
        })
    }

    // When the camera isn't following anything, its scroll is already final.
    drawIfStill()
    {
        if (!this.scene.cameras.main._follow) this.draw()
    }

    // Which ShadowSettings switch an object belongs to, or null for none.
    category(object)
    {
        if (object instanceof Phaser.Tilemaps.TilemapLayer)
        {
            return ["backgroundTiles", "terrain", "foregroundTiles"][this.tileLayers.indexOf(object)] || null
        }
        if (object instanceof Player || object instanceof AiPlayer) return "characters"
        if (object instanceof Enemy || object instanceof BlackRider) return "enemies"
        if (object instanceof Projectile) return "projectiles"
        if (object instanceof Item) return "items"
        return "other"
    }

    casts(object)
    {
        if (object === this.texture || !object.visible || object.alpha <= 0) return false
        if (!object.renderWebGL) return false

        // Only things in the world itself: not the HUD or titlecards
        // (fixed to the screen), not the backgrounds (parallax, depth -1).
        if (object.scrollFactorX !== 1 || object.scrollFactorY !== 1 || object.depth < 0) return false

        let category = this.category(object)
        return category && ShadowSettings[category]
    }

    draw()
    {
        let s = ShadowSettings
        let rt = this.texture

        rt.setVisible(s.enabled)
        if (!s.enabled) return

        rt.setTintFill(Phaser.Display.Color.HexStringToColor(s.color).color)
        rt.setAlpha(s.opacity)

        // Moving the texture's camera the opposite way moves the world the
        // shadow's way.
        let cam = this.scene.cameras.main
        rt.camera.setScroll(Math.round(cam.scrollX - s.offsetX), Math.round(cam.scrollY - s.offsetY))

        rt.clear()
        rt.beginDraw()
        rt.batchDraw(this.scene.children.list.filter(object => this.casts(object)))
        rt.endDraw()
    }
}
