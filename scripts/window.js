// 8-bit style window: black box with a 2-pixel white outline and
// notched corners, like NES RPG menus.
function drawWindow(graphics, x, y, w, h, fill)
{
    if (fill !== false)
    {
        graphics.fillStyle(0x000000, 1)
        graphics.fillRect(x + 1, y + 1, w - 2, h - 2)
    }

    graphics.fillStyle(0xffffff, 1)
    graphics.fillRect(x + 2, y, w - 4, 2)         // Top.
    graphics.fillRect(x + 2, y + h - 2, w - 4, 2) // Bottom.
    graphics.fillRect(x, y + 2, 2, h - 4)         // Left.
    graphics.fillRect(x + w - 2, y + 2, 2, h - 4) // Right.

    // Rounded corners, one pixel in.
    graphics.fillRect(x + 1, y + 1, 2, 2)
    graphics.fillRect(x + w - 3, y + 1, 2, 2)
    graphics.fillRect(x + 1, y + h - 3, 2, 2)
    graphics.fillRect(x + w - 3, y + h - 3, 2, 2)

    return graphics
}

// Text in the NES font, pixel-exact. Browsers blur the font at its native
// 8px, but at 64px every font pixel is a clean 8x8 square on the grid, so
// the text is drawn 8x bigger and each square sampled down to one pixel.
// (The font has no "/" character.) With outline, a 1-pixel black border
// is added around the letters, so the image is 1 pixel bigger on each side.
class NesText extends Phaser.GameObjects.Image
{
    constructor(scene, x, y, text, color, outline)
    {
        super(scene, x, y, "__DEFAULT")
        this.setOrigin(0, 0)
        this.textureKey = "nesText" + (NesText.count++)
        this.color = color || "#ffffff"
        this.outline = !!outline
        this.text = ""
        scene.add.existing(this)
        this.setText(text)

        this.once(Phaser.GameObjects.Events.DESTROY, () =>
        {
            if (scene.textures.exists(this.textureKey)) scene.textures.remove(this.textureKey)
        })
    }

    setText(text)
    {
        this.text = String(text)
        this.redraw()
        return this
    }

    setColor(color)
    {
        this.color = color
        this.redraw()
        return this
    }

    redraw()
    {
        const SCALE = 8
        let w = Math.max(1, this.text.length * 8)
        let h = 8

        let big = document.createElement("canvas")
        big.width = w * SCALE
        big.height = h * SCALE
        let bctx = big.getContext("2d")
        bctx.font = (8 * SCALE) + "px NES"
        bctx.textBaseline = "top"
        bctx.fillStyle = "#ffffff"
        bctx.fillText(this.text, 0, 0)
        let src = bctx.getImageData(0, 0, big.width, big.height).data

        // Which pixels are lit: the center of each font pixel's 8x8 square.
        let lit = (x, y) => x >= 0 && y >= 0 && x < w && y < h &&
            src[((y * SCALE + SCALE / 2) * big.width + x * SCALE + SCALE / 2) * 4 + 3] >= 128

        let pad = this.outline ? 1 : 0
        let ow = w + pad * 2
        let oh = h + pad * 2
        let small = document.createElement("canvas")
        small.width = ow
        small.height = oh
        let sctx = small.getContext("2d")
        let out = sctx.createImageData(ow, oh)
        let rgb = Phaser.Display.Color.HexStringToColor(this.color)
        for (let y = 0; y < oh; y++)
        {
            for (let x = 0; x < ow; x++)
            {
                let tx = x - pad
                let ty = y - pad
                let i = (y * ow + x) * 4
                if (lit(tx, ty))
                {
                    out.data[i] = rgb.red
                    out.data[i + 1] = rgb.green
                    out.data[i + 2] = rgb.blue
                    out.data[i + 3] = 255
                }
                else if (pad && (lit(tx - 1, ty) || lit(tx + 1, ty) || lit(tx, ty - 1) || lit(tx, ty + 1)))
                {
                    out.data[i + 3] = 255 // Black outline.
                }
            }
        }
        sctx.putImageData(out, 0, 0)

        let textures = this.scene.textures
        if (textures.exists(this.textureKey)) textures.remove(this.textureKey)
        textures.addCanvas(this.textureKey, small)
        this.setTexture(this.textureKey)
        this.setSize(ow, oh)
    }
}
NesText.count = 0

// Crisp NES text positioned by the top-left pixel of its letters; pass
// center = true to center it horizontally on x, outline = true for a
// black border around the letters.
function addNesText(scene, x, y, text, color, center, outline)
{
    let t = new NesText(scene, 0, 0, text, color, outline)
    let pad = outline ? 1 : 0
    t.setPosition(Math.round(center ? x - t.width / 2 : x - pad), Math.round(y - pad))
    return t
}
