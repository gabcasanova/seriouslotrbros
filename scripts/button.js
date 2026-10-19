class Button extends Phaser.GameObjects.Sprite
{
    constructor(scene, x, y, frame, execute)
    {
        super(scene, x, y, "buttons", frame)

        this.baseFrame = frame
        this.execute = execute
        this.onHover = null

        this.setInteractive({cursor: 'pointer'});

        this.on('pointerover', () =>
        {
            if (this.onHover) this.onHover(this)
            this.setSelected(true)
        });

        this.on('pointerout', () =>
        {
            this.setSelected(false)
        });

        this.on('pointerdown', function (event)
        {
            this.press()
        }, this);

        scene.add.existing(this)
    }

    // Highlighted, for the mouse hovering it or keyboard/gamepad selection.
    setSelected(selected)
    {
        this.setFrame(this.baseFrame + (selected ? 1 : 0))
    }

    press()
    {
        if (typeof this.execute !== 'undefined')
        {
            this.execute(this.scene)
        }
    }
}
