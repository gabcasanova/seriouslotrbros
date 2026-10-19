// Every playable stage. `level` indexes `levels` in main.js; the last
// entry is the Balrog fight, which has its own scene. `cropX`/`cropY` pick
// which 256x144 part of the 430x240 screenshot shows in the picture frame.
const LEVEL_SELECT = [
    {title: "THE SHIRE", act: "WORLD 1 - ACT 1", level: 0, cropX: 16, cropY: 64},
    {title: "THE SHIRE", act: "WORLD 1 - ACT 2", level: 1, cropX: 16, cropY: 64},
    {title: "THE SHIRE", act: "WORLD 1 - ACT 3", level: 2, cropX: 16, cropY: 56},
    {title: "BREE",      act: "WORLD 2 - ACT 1", level: 3, cropX: 16, cropY: 40},
    {title: "BREE",      act: "WORLD 2 - ACT 2", level: 4, cropX: 16, cropY: 56},
    {title: "BREE",      act: "WORLD 2 - ACT 3", level: 5, cropX: 96, cropY: 48},
    {title: "BREE",      act: "WORLD 2 - ACT 4", level: 6, cropX: 96, cropY: 64},
    {title: "CARADHRAS", act: "WORLD 3 - ACT 1", level: 7, cropX: 16, cropY: 64},
    {title: "CARADHRAS", act: "WORLD 3 - ACT 2", level: 8, cropX: 16, cropY: 64},
    {title: "MORIA",     act: "WORLD 4 - ACT 1", level: 9, cropX: 16, cropY: 64},
    {title: "MORIA",     act: "WORLD 4 - ACT 2", level: 9, cropX: 87, cropY: 20, scene: "Balrog"}
]

const PICTURE = {w: 256, h: 144}

class LevelSelect extends Phaser.Scene
{
    constructor()
    {
        super({key: "LevelSelect"})
    }

    preload()
    {
        this.load.audio("menuMove", "assets/sounds/coin.wav")
        LEVEL_SELECT.forEach((entry, i) =>
        {
            this.load.image("levelPicture" + i, "assets/levelselect/level" + i + ".png")
        })
    }

    create()
    {
        this.cameras.main.fadeIn(1500)
        this.leaving = false
        this.index = 0

        let cx = config.width / 2
        let px = Math.round(cx - PICTURE.w / 2)
        let py = 26
        this.picturePos = {x: px, y: py}

        addNesText(this, cx, 10, "LEVEL SELECT", "#ffffff", true)

        // Picture, framed by an 8-bit window.
        drawWindow(this.add.graphics(), px - 4, py - 4, PICTURE.w + 8, PICTURE.h + 8)
        this.picture = this.add.image(0, 0, "levelPicture0").setOrigin(0, 0)
            .setInteractive({cursor: 'pointer'})
        this.picture.on('pointerdown', () => this.play())

        // Arrows either side.
        this.arrows = [
            this.makeArrow(px - 16, py + PICTURE.h / 2, -1),
            this.makeArrow(px + PICTURE.w + 16, py + PICTURE.h / 2, 1)
        ]

        this.titleText = addNesText(this, cx, py + PICTURE.h + 12, "", "#ffffff", true)
        this.actText = addNesText(this, cx, py + PICTURE.h + 24, "", "#a0a0a0", true)

        this.show(0)

        Hints.show([
            {action: "choose", label: "LEVEL"},
            {action: "confirm", label: "PLAY"},
            {action: "cancel", label: "BACK"}
        ])
    }

    // Pixel triangle pointing left (dir -1) or right (dir 1), clickable.
    makeArrow(x, y, dir)
    {
        let g = this.add.graphics({x: x, y: y})
        g.fillStyle(0xffffff, 1)
        for (let i = 0; i < 6; i++)
        {
            // Column i is 2*i+1 pixels tall, growing away from the tip.
            let col = (dir > 0) ? -i : i
            g.fillRect(col, -i, 1, 2 * i + 1)
        }
        g.setInteractive(new Phaser.Geom.Rectangle(-8, -8, 16, 16), Phaser.Geom.Rectangle.Contains)
        g.input.cursor = 'pointer'
        g.on('pointerdown', () => this.move(dir))

        // Little NES-style bob.
        this.tweens.add({targets: g, x: x + dir * 2, duration: 300, yoyo: true, repeat: -1, ease: 'Stepped'})
        return g
    }

    show(index)
    {
        let count = LEVEL_SELECT.length
        this.index = (index + count) % count
        let entry = LEVEL_SELECT[this.index]

        // Show a 256x144 part of the full screenshot.
        let cropX = entry.cropX
        this.picture.setTexture("levelPicture" + this.index)
        this.picture.setCrop(cropX, entry.cropY, PICTURE.w, PICTURE.h)
        this.picture.setPosition(this.picturePos.x - cropX, this.picturePos.y - entry.cropY)
        this.picture.input.hitArea.setTo(cropX, entry.cropY, PICTURE.w, PICTURE.h)

        this.setCenteredText(this.titleText, entry.title)
        this.setCenteredText(this.actText, entry.act + "   " + (this.index + 1) + " OF " + count)
    }

    setCenteredText(text, value)
    {
        text.setText(value)
        text.x = Math.round(config.width / 2 - text.width / 2)
    }

    move(dir)
    {
        if (this.leaving) return
        this.sound.play("menuMove")
        this.show(this.index + dir)
    }

    play()
    {
        if (this.leaving) return
        this.leaving = true
        Hints.hide()

        let entry = LEVEL_SELECT[this.index]
        currentLevel = entry.level
        this.cameras.main.fadeOut(1500)
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(entry.scene || "Level"))
    }

    back()
    {
        if (this.leaving) return
        this.leaving = true
        Hints.hide()

        this.cameras.main.fadeOut(1500)
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start("Menu", {skipIntro: true}))
    }

    update()
    {
        if (GameInput.justPressed("left"))    this.move(-1)
        if (GameInput.justPressed("right"))   this.move(1)
        if (GameInput.justPressed("confirm")) this.play()
        if (GameInput.justPressed("cancel"))  this.back()
    }
}
