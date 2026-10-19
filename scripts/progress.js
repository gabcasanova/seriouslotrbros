// Which stages the player has got through, kept in this browser. Stages are
// numbered like LEVEL_SELECT: 0-9 are the levels, 10 is the Balrog fight.
const BALROG_STAGE = 10

const Progress = {
    cleared: [],

    load()
    {
        try
        {
            let saved = JSON.parse(localStorage.getItem("clearedStages"))
            if (Array.isArray(saved)) this.cleared = saved
        }
        catch (e) {}
    },

    save()
    {
        try { localStorage.setItem("clearedStages", JSON.stringify(this.cleared)) } catch (e) {}
    },

    clear(stage)
    {
        if (!this.cleared.includes(stage))
        {
            this.cleared.push(stage)
            this.save()
        }
    },

    // Playable from the Level Select: the first stage, every cleared one,
    // and the one right after a cleared one.
    isUnlocked(stage)
    {
        return stage == 0 || this.cleared.includes(stage) || this.cleared.includes(stage - 1)
    },

    unlockAll(count)
    {
        for (let i = 0; i < count; i++) this.clear(i)
    }
}

Progress.load()
