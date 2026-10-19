// Turns assets/sprites/sonic.png (a ripped sheet with uneven cells and two
// background colors) into even, transparent spritesheets:
//   "sonicSheet": 32x40 frames, each sprite bottom-centered.
//   "ringSheet":  16x16 spinning ring frames.
// Load the raw sheet as an image with key "sonicRaw" first.

// [x, y, w, h] of each sprite in sonic.png (top copy of the sheet).
const SONIC_FRAMES = {
    idle:     [[153, 1, 18, 32]],
    walk:     [[1, 2, 24, 31], [28, 2, 21, 31], [54, 3, 17, 30], [78, 2, 22, 31], [104, 2, 19, 31]],
    run:      [[3, 36, 18, 30], [29, 36, 17, 30], [53, 36, 18, 30], [79, 36, 17, 30]],
    ball:     [[228, 1, 20, 24], [253, 1, 20, 23], [278, 1, 20, 24], [303, 1, 20, 24]],
    spindash: [[3, 67, 20, 24]],
    crouch:   [[203, 2, 20, 22]],
    skid:     [[126, 36, 24, 30]],
    hurt:     [[103, 34, 21, 32]]
}
const RING_FRAMES = [[4, 207, 11, 16], [22, 207, 8, 16], [41, 207, 4, 16], [56, 207, 8, 16]]

const SONIC_BACKGROUNDS = [0x94bded, 0x14589a]
const SONIC_CELL = {w: 32, h: 40}

// Frame numbers in sonicSheet for each animation, filled in by the builder.
const SONIC_ANIM_FRAMES = {}

function buildSonicSprites(scene)
{
    if (scene.textures.exists("sonicSheet")) return

    let raw = scene.textures.get("sonicRaw").getSourceImage()
    let src = document.createElement("canvas")
    src.width = raw.width
    src.height = raw.height
    let sctx = src.getContext("2d")
    sctx.drawImage(raw, 0, 0)

    // Copies a rect from the raw sheet into ctx, with backgrounds removed.
    let blit = (ctx, rect, dx, dy) =>
    {
        let [x, y, w, h] = rect
        let data = sctx.getImageData(x, y, w, h)
        let d = data.data
        for (let i = 0; i < d.length; i += 4)
        {
            if (SONIC_BACKGROUNDS.includes((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])) d[i + 3] = 0
        }
        ctx.putImageData(data, dx, dy)
    }

    let all = []
    for (let name in SONIC_FRAMES)
    {
        SONIC_ANIM_FRAMES[name] = SONIC_FRAMES[name].map(rect => { all.push(rect); return all.length - 1 })
    }

    let sheet = document.createElement("canvas")
    sheet.width = all.length * SONIC_CELL.w
    sheet.height = SONIC_CELL.h
    let ctx = sheet.getContext("2d")
    all.forEach((rect, i) => blit(ctx, rect, i * SONIC_CELL.w + Math.floor((SONIC_CELL.w - rect[2]) / 2), SONIC_CELL.h - rect[3]))
    scene.textures.addSpriteSheet("sonicSheet", sheet, {frameWidth: SONIC_CELL.w, frameHeight: SONIC_CELL.h})

    let rings = document.createElement("canvas")
    rings.width = RING_FRAMES.length * 16
    rings.height = 16
    let rctx = rings.getContext("2d")
    RING_FRAMES.forEach((rect, i) => blit(rctx, rect, i * 16 + Math.floor((16 - rect[2]) / 2), 0))
    scene.textures.addSpriteSheet("ringSheet", rings, {frameWidth: 16, frameHeight: 16})
}

// The spinning ring animation (global, made once).
function ringAnimation(scene)
{
    if (!scene.anims.exists("ringSpin"))
    {
        scene.anims.create({
            key: "ringSpin",
            frames: scene.anims.generateFrameNumbers("ringSheet", {start: 0, end: RING_FRAMES.length - 1}),
            frameRate: 10,
            repeat: -1
        })
    }
    return "ringSpin"
}
