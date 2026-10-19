// Things you can buy in the Shop with coins, and which one is switched on.
// Only one bought thing can be on at a time. Kept in this browser.
const SHOP_ITEMS = [
    {id: "sonic", name: "SONIC", price: 382, about: "PLAY AS SONIC THE HEDGEHOG"}
]

const ShopStore = {
    owned: [],
    active: null,

    load()
    {
        try
        {
            let saved = JSON.parse(localStorage.getItem("shop"))
            if (saved)
            {
                this.owned = saved.owned || []
                this.active = saved.active || null
            }
        }
        catch (e) {}
    },

    save()
    {
        try { localStorage.setItem("shop", JSON.stringify({owned: this.owned, active: this.active})) } catch (e) {}
    },

    owns(id)
    {
        return this.owned.includes(id)
    },

    isOn(id)
    {
        return this.active == id
    },

    // Spends the coins. Returns false if there aren't enough.
    buy(item)
    {
        if (this.owns(item.id) || CoinStore.total < item.price) return false
        CoinStore.add(-item.price)
        this.owned.push(item.id)
        this.save()
        return true
    },

    // Switches an owned thing on (and every other one off), or off again.
    toggle(id)
    {
        if (!this.owns(id)) return
        this.active = this.isOn(id) ? null : id
        this.save()
    }
}

ShopStore.load()
