// Top-left of the screen: the super charge bar and the keys collected.
const SUPER_COLOR = 0xf87800
const SUPER_READY_COLOR = 0x3cbcfc // Blue once full.
const SUPER_EMPTY_COLOR = 0x3c3c3c

class LevelHud
{
    constructor(scene)
    {
        this.scene = scene
        this.player = scene.player
        this.shown = -1

        let x = 6
        if (this.player.canSuper())
        {
            this.label = addNesText(scene, x, 7, "SUPER", "#ffffff", false, true)
                .setScrollFactor(0).setDepth(3)
            this.bar = scene.add.graphics().setScrollFactor(0).setDepth(3)
            this.barX = x + 44
            this.barY = 6
            x = this.barX + SUPER_CHARGE_MAX * 4 + 3 + 6
        }

        // Coins picked up in this stage, below the bar.
        let coinY = this.bar ? 20 : 6
        this.coinIcon = scene.add.image(4, coinY - 4, "items", 1).setOrigin(0, 0).setScrollFactor(0).setDepth(3)
        this.coinText = addNesText(scene, 20, coinY, this.coinLabel(), "#ffffff", false, true)
            .setScrollFactor(0).setDepth(3)
        this.coinsShown = 0

        // Keys appear next to the bar once picked up.
        this.keys = {
            red: scene.add.image(x, 2, "items", 4),
            yellow: scene.add.image(x + 14, 2, "items", 5)
        }
        Object.values(this.keys).forEach(key => key.setOrigin(0, 0).setScrollFactor(0).setDepth(3).setVisible(false))

        // Everything shifts right when the window crops the screen's left edge.
        this.offset = 0
        this.items = [this.label, this.bar, this.coinIcon, this.coinText, this.keys.red, this.keys.yellow, scene.lifebar]
            .filter(Boolean)
            .map(o => ({object: o, x: o.x}))
    }

    followVisibleEdge()
    {
        let offset = Math.ceil(Overlay.visibleBounds().left)
        if (offset == this.offset) return
        this.offset = offset
        this.items.forEach(i => i.object.x = i.x + offset)
    }

    coinLabel()
    {
        let pad = n => String(n).padStart(2, "0")
        return pad(this.scene.coinsCollected.size) + "/" + pad(this.scene.coinIds.length)
    }

    update()
    {
        this.followVisibleEdge()
        if (this.bar) this.drawBar()

        if (this.scene.coinsCollected.size != this.coinsShown)
        {
            this.coinsShown = this.scene.coinsCollected.size
            this.coinText.setText(this.coinLabel())
        }

        for (let color of ["red", "yellow"])
        {
            let icon = this.keys[color]
            if (this.player.keys[color] && !icon.visible)
            {
                // Pop in with a few NES-style blinks.
                icon.setVisible(true)
                this.scene.tweens.add({targets: icon, alpha: 0, duration: 80, yoyo: true, repeat: 3, ease: "Stepped"})
            }
        }
    }

    // Segmented bar: one segment per enemy hit. Turns blue once full.
    drawBar()
    {
        let charge = this.player.charge
        let ready = charge >= SUPER_CHARGE_MAX
        if (charge === this.shown) return
        this.shown = charge

        let w = SUPER_CHARGE_MAX * 4 + 3
        let h = 10
        let g = this.bar.clear()

        // Black box with a 1-pixel white outline.
        g.fillStyle(0xffffff, 1).fillRect(this.barX, this.barY, w, h)
        g.fillStyle(0x000000, 1).fillRect(this.barX + 1, this.barY + 1, w - 2, h - 2)

        let fill = ready ? SUPER_READY_COLOR : SUPER_COLOR
        for (let i = 0; i < SUPER_CHARGE_MAX; i++)
        {
            g.fillStyle(i < charge ? fill : SUPER_EMPTY_COLOR, 1)
            g.fillRect(this.barX + 2 + i * 4, this.barY + 2, 3, h - 4)
        }
    }
}
