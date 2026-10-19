// Stage introduction card: the picture from cutsceneLevel.png (its top
// part), then the story text and the stage name from assets/stages.json.
const INTRO_PICTURE_HEIGHT = 108 // Picture and its frame, in each 256x240 card.
const INTRO_CHARS_PER_LINE = [36, 40, 44, 48, 52] // Widest used only if needed.
const INTRO_TEXT_BOTTOM = 198                     // Keep clear of the stage name.
const INTRO_LINE_HEIGHT = 9
const INTRO_PARAGRAPH_GAP = 5
const INTRO_LETTERS_PER_SECOND = 45 // Typewriter speed.

// Splits "a [red]b c[/] d" into words, each a list of {char, color}.
function parseIntroText(text, colors)
{
    let words = []
    let word = []
    let color = colors.white || "#ffffff"
    let i = 0

    while (i < text.length)
    {
        // Color tags: [name] or [#rrggbb] to start, [/] to go back to white.
        if (text[i] == "[")
        {
            let end = text.indexOf("]", i)
            if (end > i)
            {
                let tag = text.slice(i + 1, end)
                color = (tag == "/") ? (colors.white || "#ffffff") : (colors[tag] || tag)
                i = end + 1
                continue
            }
        }

        let ch = text[i].toUpperCase()
        if (ch == " ")
        {
            if (word.length) words.push(word)
            word = []
        }
        else
        {
            word.push({char: ch, color: color})
        }
        i++
    }
    if (word.length) words.push(word)
    return words
}

// Word-wraps parsed words into lines of {char, color}.
function wrapIntroWords(words, width)
{
    let lines = []
    let line = []
    for (let word of words)
    {
        let needed = line.length ? line.length + 1 + word.length : word.length
        if (needed > width && line.length)
        {
            lines.push(line)
            line = []
        }
        if (line.length) line.push({char: " ", color: line[line.length - 1].color})
        line.push(...word)
    }
    if (line.length) lines.push(line)
    return lines
}

// Draws one line, as one NesText per run of the same color. Each piece is
// added to `typed` with where it starts in the story, for the typewriter.
function drawIntroLine(scene, line, x, y, objects, typed, offset)
{
    let start = 0
    while (start < line.length)
    {
        let end = start
        while (end < line.length && line[end].color == line[start].color) end++
        let text = line.slice(start, end).map(c => c.char).join("")
        if (text.trim())
        {
            let piece = new NesText(scene, x + start * 8, y, text, line[start].color)
            objects.push(piece)
            typed.push({text: piece, start: offset + start, length: text.length})
        }
        start = end
    }
}

// Builds the card. Returns {objects, update(delta), skip(), done}: the story
// types itself out letter by letter in update(), skip() shows all of it.
function buildStageIntro(scene, level, depth)
{
    let data = scene.cache.json.get("stages")
    let stage = data.stages[level]
    let colors = data.colors
    let objects = []
    let typed = []
    let letters = 0
    let cx = config.width / 2

    // Picture.
    objects.push(scene.add.sprite(cx, 0, "cutsceneLevel", level)
        .setOrigin(0.5, 0)
        .setCrop(0, 0, 256, INTRO_PICTURE_HEIGHT))

    // Story text: the narrowest width that fits above the stage name.
    let top = INTRO_PICTURE_HEIGHT + 6
    let width, paragraphs, height
    for (width of INTRO_CHARS_PER_LINE)
    {
        paragraphs = stage.text.map(p => wrapIntroWords(parseIntroText(p, colors), width))
        let lines = paragraphs.reduce((n, p) => n + p.length, 0)
        height = lines * INTRO_LINE_HEIGHT + (paragraphs.length - 1) * INTRO_PARAGRAPH_GAP
        if (top + height <= INTRO_TEXT_BOTTOM) break
    }
    if (top + height > INTRO_TEXT_BOTTOM) console.warn("Stage " + level + " intro text is too long to fit.")

    let left = Math.round(cx - width * 4)
    let y = top
    for (let lines of paragraphs)
    {
        for (let line of lines)
        {
            let x = (stage.align == "center") ? Math.round(cx - line.length * 4) : left
            drawIntroLine(scene, line, x, y, objects, typed, letters)
            letters += line.length
            y += INTRO_LINE_HEIGHT
        }
        y += INTRO_PARAGRAPH_GAP
    }

    // Stage name, the same layout for every stage: "WORLD N - ACT N" and
    // the world's name below, twice the size with a shadow.
    let world = data.worlds[stage.world]
    let worldText = "WORLD " + stage.world
    let actText = "ACT " + stage.act
    let header = worldText + " - " + actText
    let hx = Math.round(cx - header.length * 4)
    objects.push(new NesText(scene, hx, 204, worldText, colors.red))
    objects.push(new NesText(scene, hx + worldText.length * 8, 204, " - ", "#ffffff"))
    objects.push(new NesText(scene, hx + (worldText.length + 3) * 8, 204, actText, "#49a269"))

    let nx = Math.round(cx - world.name.length * 8)
    objects.push(new NesText(scene, nx + 2, 216 + 2, world.name, world.shadow).setScale(2))
    objects.push(new NesText(scene, nx, 216, world.name, world.color).setScale(2))

    objects.forEach(o => o.setScrollFactor(0, 0).setDepth(depth))

    let intro = {
        objects: objects,
        shown: 0,
        done: false,

        // Crops each piece to the letters typed so far.
        show(count)
        {
            this.shown = Math.min(count, letters)
            for (let t of typed)
            {
                let visible = Phaser.Math.Clamp(this.shown - t.start, 0, t.length)
                t.text.setVisible(visible > 0)
                t.text.setCrop(0, 0, visible * 8, t.text.height)
            }
            this.done = this.shown >= letters
        },

        update(delta)
        {
            if (!this.done) this.show(this.shown + delta / 1000 * INTRO_LETTERS_PER_SECOND)
        },

        skip()
        {
            this.show(letters)
        }
    }
    intro.show(0)
    return intro
}
