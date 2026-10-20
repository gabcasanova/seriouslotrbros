// Shop: spend coins on things, then switch one of them on.
class Shop extends Phaser.Scene
{
    constructor()
    {
        super({key: "Shop"})
    }

    preload()
    {
        this.load.image("sonicRaw", "assets/sprites/sonic.png")
        loadPierre(this)
        this.load.spritesheet("items", "assets/sprites/items.png", {frameWidth: 16, frameHeight: 16})
        this.load.audio("buy", "assets/sounds/life.wav")
        this.load.audio("menuMove", "assets/sounds/coin.wav")
        this.load.audio("locked", "assets/sounds/bump.wav")
    }

    create()
    {
        this.cameras.main.fadeIn(1500)
        this.leaving = false
        buildSonicSprites(this)

        let cx = config.width / 2
        addNesText(this, cx, 10, "SHOP", "#ffffff", true)

        // Coins to spend, top-left (kept inside the visible area).
        this.coinIcon = this.add.image(4, 6, "items", 1).setOrigin(0, 0)
        this.coinText = addNesText(this, 20, 10, "", "#ffffff", false, true)

        // One row per item: picture, name, price or state.
        let w = 280
        let x = Math.round(cx - w / 2)
        this.rows = SHOP_ITEMS.map((item, i) =>
        {
            let y = 32 + i * 52
            let row = {item: item, x: x, y: y, w: w, h: 46}
            row.frame = this.add.graphics()
            row.icon = item.id == "pierre"
                ? this.add.image(x + 26, y + 24, "pierre", 0).setOrigin(0.5, PIERRE.originY)
                : this.add.image(x + 26, y + 23, "sonicSheet", SONIC_ANIM_FRAMES.idle[0])
            row.name = addNesText(this, x + 52, y + 9, item.name)
            row.about = addNesText(this, x + 52, y + 21, item.about, "#a0a0a0")
            row.state = addNesText(this, x + 52, y + 33, "")

            row.frame.setInteractive(new Phaser.Geom.Rectangle(x, y, w, row.h), Phaser.Geom.Rectangle.Contains)
            row.frame.input.cursor = "pointer"
            row.frame.on("pointerover", () => this.select(i))
            row.frame.on("pointerdown", () => { this.select(i); this.choose() })
            return row
        })

        this.message = addNesText(this, cx, 200, "", "#ffffff", true)
        this.select(0)

        Hints.show([
            {action: "navigate", label: "SELECT"},
            {action: "confirm", label: "OK"},
            {action: "cancel", label: "BACK"}
        ])
    }

    refresh()
    {
        this.coinText.setText(String(CoinStore.total))
        this.rows.forEach((row, i) =>
        {
            let item = row.item
            let selected = i == this.selected
            drawWindow(row.frame.clear(), row.x, row.y, row.w, row.h, true, selected ? 0xffffff : 0x7c7c7c)

            if (!ShopStore.owns(item.id))
            {
                let afford = CoinStore.total >= item.price
                row.state.setText("PRICE " + item.price + " COINS").setColor(afford ? "#f8b800" : "#db4161")
            }
            else
            {
                let on = ShopStore.isOn(item.id)
                row.state.setText(on ? "ON" : "OFF").setColor(on ? "#51a200" : "#a0a0a0")
            }
        })
    }

    select(index)
    {
        this.selected = index
        this.refresh()
    }

    say(text)
    {
        this.message.setText(text)
        this.message.x = Math.round(config.width / 2 - this.message.width / 2)
    }

    choose()
    {
        if (this.leaving) return
        let item = this.rows[this.selected].item

        if (!ShopStore.owns(item.id))
        {
            if (ShopStore.buy(item))
            {
                this.sound.play("buy")
                ShopStore.toggle(item.id) // Switch it on right away.
                this.say("THANK YOU! " + item.name + " IS ON")
            }
            else
            {
                this.sound.play("locked")
                this.cameras.main.shake(100, 0.005)
                this.say("NOT ENOUGH COINS!")
            }
        }
        else
        {
            ShopStore.toggle(item.id)
            this.sound.play("menuMove")
            this.say(item.name + (ShopStore.isOn(item.id) ? " IS ON" : " IS OFF"))
        }
        this.refresh()
    }

    back()
    {
        if (this.leaving) return
        this.leaving = true
        Hints.hide()
        this.cameras.main.fadeOut(1500)
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("Menu", {skipIntro: true}))
    }

    update()
    {
        let left = Math.ceil(Overlay.visibleBounds().left)
        this.coinIcon.x = left + 4
        this.coinText.x = left + 19

        let count = this.rows.length
        if (GameInput.justPressed("down")) this.select((this.selected + 1) % count)
        if (GameInput.justPressed("up"))   this.select((this.selected + count - 1) % count)
        if (GameInput.justPressed("confirm")) this.choose()
        if (GameInput.justPressed("cancel"))  this.back()
    }
}
