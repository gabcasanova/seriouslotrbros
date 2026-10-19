// 8-bit style window: black box with a 2-pixel white (or `color`) outline
// and notched corners, like NES RPG menus.
function drawWindow(graphics, x, y, w, h, fill, color)
{
    if (fill !== false)
    {
        graphics.fillStyle(0x000000, 1)
        graphics.fillRect(x + 1, y + 1, w - 2, h - 2)
    }

    graphics.fillStyle(color === undefined ? 0xffffff : color, 1)
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
// Characters the font lacks are drawn from NES_EXTRA_GLYPHS. With outline,
// a 1-pixel black border is added, so the image is 1 pixel bigger on each
// side. Multi-line text is centered line by line.
const NES_EXTRA_GLYPHS = {
    "/": ["........", ".....##.", "....##..", "...##...", "..##....", ".##.....", "##......", "........"],
    "(": ["........", "...##...", "..##....", ".##.....", ".##.....", ".##.....", "..##....", "...##..."],
    ")": ["........", ".##.....", "..##....", "...##...", "...##...", "...##...", "..##....", ".##....."],
    "=": ["........", "........", ".######.", "........", "........", ".######.", "........", "........"]
}

class NesText extends Phaser.GameObjects.Image
{
    constructor(scene, x, y, text, color, outline, lineHeight)
    {
        super(scene, x, y, "__DEFAULT")
        this.setOrigin(0, 0)
        this.textureKey = "nesText" + (NesText.count++)
        this.color = color || "#ffffff"
        this.outline = !!outline
        this.lineHeight = lineHeight || 10
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
        let lines = this.text.split(/\r?\n/)
        let w = Math.max(1, ...lines.map(l => l.length * 8))
        let h = (lines.length - 1) * this.lineHeight + 8

        // Which pixels are lit.
        let mask = new Uint8Array(w * h)
        lines.forEach((line, n) =>
        {
            if (!line.length) return
            let ox = Math.round((w - line.length * 8) / 2)
            let oy = n * this.lineHeight

            let big = document.createElement("canvas")
            big.width = line.length * 8 * SCALE
            big.height = 8 * SCALE
            let ctx = big.getContext("2d")
            ctx.font = (8 * SCALE) + "px NES"
            ctx.textBaseline = "top"
            ctx.fillStyle = "#ffffff"
            // Draw each character in its own cell, so a missing one can't
            // shift the rest.
            ;[...line].forEach((ch, i) =>
            {
                if (!NES_EXTRA_GLYPHS[ch]) ctx.fillText(ch, i * 8 * SCALE, 0)
            })
            let src = ctx.getImageData(0, 0, big.width, big.height).data

            ;[...line].forEach((ch, i) =>
            {
                let extra = NES_EXTRA_GLYPHS[ch]
                for (let y = 0; y < 8; y++)
                {
                    for (let x = 0; x < 8; x++)
                    {
                        let on = extra ? extra[y][x] == "#" :
                            src[((y * SCALE + SCALE / 2) * big.width + (i * 8 + x) * SCALE + SCALE / 2) * 4 + 3] >= 128
                        if (on) mask[(oy + y) * w + ox + i * 8 + x] = 1
                    }
                }
            })
        })

        let lit = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] == 1

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
        if (this.input) this.input.hitArea.setSize(ow, oh)
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

// Texture from rows of pixels: "#" white, "r" red, or letters looked up
// in `palette`; anything else is clear.
function pixelTexture(scene, key, rows, palette)
{
    if (scene.textures.exists(key)) return key

    let canvas = document.createElement("canvas")
    canvas.width = rows[0].length
    canvas.height = rows.length
    let ctx = canvas.getContext("2d")
    rows.forEach((row, y) => [...row].forEach((p, x) =>
    {
        if (palette && palette[p]) ctx.fillStyle = palette[p]
        else if (p == "#") ctx.fillStyle = "#ffffff"
        else if (p == "r") ctx.fillStyle = "#d82800"
        else return
        ctx.fillRect(x, y, 1, 1)
    }))
    scene.textures.addCanvas(key, canvas)
    return key
}

// Same icon with a red slash across it, for "off".
function slashedIcon(rows)
{
    let h = rows.length
    let w = rows[0].length
    return rows.map((row, y) => [...row].map((p, x) =>
    {
        let d = Math.round(x * (h - 1) / (w - 1)) - y
        return (d == 0 || d == 1) ? "r" : p
    }).join(""))
}

const MUSIC_ICON = [
    "...######.",
    "...######.",
    "...#....#.",
    "...#....#.",
    "...#....#.",
    ".###..###.",
    "####.####.",
    "####.####.",
    ".##...##.."
]

const SPEAKER_ICON = [
    "....#.....",
    "...##...#.",
    "#####.#..#",
    "#####..#.#",
    "#####..#.#",
    "#####.#..#",
    "...##...#.",
    "....#.....",
    ".........."
]

// Small 16x16 window with an icon that switches music or sound effects
// on and off. Outline is white while selected, gray otherwise.
class SoundToggle
{
    constructor(scene, x, y, kind)
    {
        this.scene = scene
        this.x = x
        this.y = y
        this.kind = kind
        this.selected = false
        this.onHover = null

        let rows = (kind == "music") ? MUSIC_ICON : SPEAKER_ICON
        this.onKey = pixelTexture(scene, kind + "IconOn", rows)
        this.offKey = pixelTexture(scene, kind + "IconOff", slashedIcon(rows))

        this.graphics = scene.add.graphics()
        this.icon = scene.add.image(x + 3, y + 4, this.onKey).setOrigin(0, 0)

        this.hitArea = new Phaser.Geom.Rectangle(x, y, 16, 16)
        this.graphics.setInteractive(this.hitArea, Phaser.Geom.Rectangle.Contains)
        this.graphics.input.cursor = 'pointer'
        this.graphics.on('pointerover', () => { if (this.onHover) this.onHover(this) })
        this.graphics.on('pointerdown', () => this.press())

        this.refresh = () =>
        {
            this.icon.setTexture(AudioSettings[this.kind] ? this.onKey : this.offKey)
        }
        AudioSettings.onChange(this.refresh)
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => AudioSettings.offChange(this.refresh))

        this.refresh()
        this.setSelected(false)
    }

    setSelected(selected)
    {
        this.selected = selected
        drawWindow(this.graphics.clear(), this.x, this.y, 16, 16, true, selected ? 0xffffff : 0x7c7c7c)
    }

    moveTo(x, y)
    {
        if (x == this.x && y == this.y) return
        this.x = x
        this.y = y
        this.icon.setPosition(x + 3, y + 4)
        this.hitArea.setPosition(x, y)
        this.setSelected(this.selected)
    }

    press()
    {
        AudioSettings.toggle(this.kind)
    }
}
