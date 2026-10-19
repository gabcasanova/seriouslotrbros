// NES games faded by stepping the palette through a few brightness levels
// instead of a smooth ramp. Quantize every camera fade to match.

const NES_FADE_STEPS = 4

// Every fade runs this many times faster than the duration it's given.
const FADE_SPEED = 3

;(function ()
{
    const Fade = Phaser.Cameras.Scene2D.Effects.Fade
    const start = Fade.prototype.start
    const update = Fade.prototype.update

    Fade.prototype.start = function (direction, duration, red, green, blue, force, callback, context)
    {
        if (duration === undefined) duration = 1000
        return start.call(this, direction, duration / FADE_SPEED, red, green, blue, force, callback, context)
    }

    Fade.prototype.update = function (time, delta)
    {
        update.call(this, time, delta)

        if (this.isRunning)
        {
            // Fading out steps up only once a level is fully reached, fading
            // in steps down, so both start and end exactly where they should.
            let a = this.alpha * NES_FADE_STEPS
            this.alpha = (this.direction ? Math.floor(a) : Math.ceil(a)) / NES_FADE_STEPS
        }
    }
})()
