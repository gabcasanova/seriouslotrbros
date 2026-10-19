// Player colors for online play: NES-style palette swaps of Frodo and Sonic.
// Frodo's green outfit becomes the color (and his brown a darker shade);
// Sonic's blues take its hue but keep their light and dark shading.
const PLAYER_COLORS = [
    {name: "CLASSIC", hex: null},
    {name: "RED",     hex: "#d82800"},
    {name: "BLUE",    hex: "#0058f8"},
    {name: "GREEN",   hex: "#00a800"},
    {name: "GOLD",    hex: "#f8b800"},
    {name: "PURPLE",  hex: "#8c3cdc"},
    {name: "PINK",    hex: "#f878f8"},
    {name: "CYAN",    hex: "#00b8d8"},
    {name: "SILVER",  hex: "#a8a8a8"}
]

const FRODO_OUTFIT = 0x386900
const FRODO_CLOAK = 0x794100

// Texture key for a character ("frodo" or "sonic") in a color, made once.
function playerTexture(scene, character, colorIndex)
{
    let base = (character == "sonic") ? "sonicSheet" : "frodo"
    let color = PLAYER_COLORS[colorIndex] || PLAYER_COLORS[0]
    if (!color.hex) return base

    let key = base + "_" + colorIndex
    if (scene.textures.exists(key)) return key

    let source = scene.textures.get(base).getSourceImage()
    let canvas = document.createElement("canvas")
    canvas.width = source.width
    canvas.height = source.height
    let ctx = canvas.getContext("2d")
    ctx.drawImage(source, 0, 0)
    let image = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let d = image.data

    let target = Phaser.Display.Color.HexStringToColor(color.hex)
    let targetHsv = Phaser.Display.Color.RGBToHSV(target.red, target.green, target.blue)
    let dark = {r: target.red * 0.55, g: target.green * 0.55, b: target.blue * 0.55}

    for (let i = 0; i < d.length; i += 4)
    {
        if (d[i + 3] == 0) continue
        let r = d[i], g = d[i + 1], b = d[i + 2]
        let rgb = (r << 16) | (g << 8) | b

        if (character == "frodo")
        {
            if (rgb == FRODO_OUTFIT) { d[i] = target.red; d[i + 1] = target.green; d[i + 2] = target.blue }
            else if (rgb == FRODO_CLOAK) { d[i] = dark.r; d[i + 1] = dark.g; d[i + 2] = dark.b }
        }
        else if (b > r + 40 && b > g)
        {
            // Sonic's blue: new hue, same brightness.
            let hsv = Phaser.Display.Color.RGBToHSV(r, g, b)
            let out = Phaser.Display.Color.HSVToRGB(targetHsv.h, targetHsv.s < 0.1 ? 0 : hsv.s, hsv.v)
            d[i] = out.r; d[i + 1] = out.g; d[i + 2] = out.b
        }
    }
    ctx.putImageData(image, 0, 0)

    let frame = (character == "sonic") ? SONIC_CELL : {w: 33, h: 33}
    scene.textures.addSpriteSheet(key, canvas, {frameWidth: frame.w, frameHeight: frame.h})
    return key
}
