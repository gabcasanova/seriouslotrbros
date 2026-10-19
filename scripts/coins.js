// All the coins the player has ever collected, as one running total kept
// in this browser. Replaying a stage adds its coins again. Coins are only
// banked when a stage is cleared (see Level.finishLevel).

// Coins in each stage, counted from the tilemaps (282 in all). Levels
// check this when they load and warn if a map changed.
const COINS_PER_STAGE = [37, 68, 15, 63, 31, 38, 6, 14, 10, 0]
const COINS_IN_GAME = COINS_PER_STAGE.reduce((a, b) => a + b, 0)

const CoinStore = {
    total: 0,

    load()
    {
        try
        {
            let saved = Number(localStorage.getItem("coinTotal"))
            if (saved > 0) this.total = saved
        }
        catch (e) {}
    },

    add(amount)
    {
        this.total += amount
        try { localStorage.setItem("coinTotal", String(this.total)) } catch (e) {}
    }
}

CoinStore.load()

// Sonic-style tally window at height y: `amount` counts down next to
// `label` while the saved total counts up, then `done` runs. The coins are
// saved right away, so cutting the tally short loses nothing.
function runCoinTally(scene, amount, label, y, done)
{
    let total = CoinStore.total
    CoinStore.add(amount)

    let w = 168
    let h = 40
    let x = Math.round((config.width - w) / 2)
    let value = (n) => String(n).padStart(5, " ")
    let line = (text, n) => (text + "          ").slice(0, 10) + value(n)

    let objects = [drawWindow(scene.add.graphics(), x, y, w, h)]
    let amountLine = addNesText(scene, x + 12, y + 10, line(label, amount))
    let totalLine = addNesText(scene, x + 12, y + 22, line("TOTAL", total))
    objects.push(amountLine, totalLine)
    objects.forEach(o => o.setScrollFactor(0, 0).setDepth(5))

    let finish = () => scene.time.delayedCall(1500, done)
    if (amount == 0)
    {
        scene.time.delayedCall(1000, finish)
        return
    }

    // About 50ms a coin, but never longer than ~2.5s in all.
    let step = Math.max(1, Math.ceil(amount / 50))
    scene.time.delayedCall(500, () =>
    {
        let left = amount
        let event = scene.time.addEvent({
            delay: 50,
            loop: true,
            callback: () =>
            {
                let n = Math.min(step, left)
                left -= n
                total += n
                amountLine.setText(line(label, left))
                totalLine.setText(line("TOTAL", total))
                scene.sound.play("coin")
                if (left == 0)
                {
                    event.remove()
                    finish()
                }
            }
        })
    })
}
