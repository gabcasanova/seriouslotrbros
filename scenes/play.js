class Play extends Phaser.Scene
{
    constructor()
    {
        super({key: "Play"})
    }

    preload()
    {
        this.load.image("playButton", "assets/sprites/playButton.png")
    }

    create()
    {
        this.started = false

        let playButton = this.add.sprite(config.width/2, config.height/2, "playButton")
            .setInteractive({cursor: 'pointer'});

        playButton.on('pointerdown', function (event)
        {
            this.startGame()
        }, this);

        Hints.show([{action: "confirm", label: "START"}])
    }

    startGame()
    {
        if (this.started) return
        this.started = true
        Hints.hide()
        this.scene.start("Menu");
    }

    update()
    {
        if (GameInput.justPressed("confirm"))
        {
            this.startGame()
        }
    }
}
