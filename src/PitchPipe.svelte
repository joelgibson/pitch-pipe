<!-- Pitch pipe app

Conventions:
 - Angles are in units of turns, so 0.25 means a quarter turn, etc. Since angles are converted to
   radians, degrees, and frequencies in various parts of the app, this made the most sense.
 - Some angles can go very positive or negative, i.e. not all angles are in [0, 1).
 - To convert an angle to a pitch, treat the angle as a logarithmic quantity relative to middle C.
   So freq = C4_FREQ * Math.pow(2, angle).
-->

<script lang="ts">
import AnnularButton from "./AnnularButton.svelte"

// First some "musical constants".

// Scientific pitch notation: A4 is 440Hz, and the number after the letter increases as we go
// up from B to C. This array records the chromatic scale starting from C
const SCALE_LETTERS = 'C,C#,D,D#,E,F,F#,G,G#,A,A#,B'.split(',')

// The pitch of middle C (C4), if A4 is tuned to 440 Hz.
const C4_FREQ = 440 * Math.pow(2, -9/12)

// Numberings for positions in the scale.
const scalePositions = [
    {text: '1', angle: 0/12},
    {text: '2', angle: 2/12},
    {text: '3', angle: 4/12},
    {text: '4', angle: 5/12},
    {text: '5', angle: 7/12},
    {text: '6', angle: 9/12},
    {text: '7', angle: 11/12},
]

/** Get the pitch notation for a frequency, snapping to nearest semitone. */
function pitchNotation(freq: number) {
    // Convert to a semitone distance from middle C, and snap to the nearest semitone.
    let semitones = Math.round(Math.log2(freq / C4_FREQ) * 12)
    let letter = SCALE_LETTERS[(semitones % 12 + 12) % 12]
    let number = Math.floor(semitones / 12) + 4
    return letter + number
}

// Now introduce the pressable note buttons. There are two kinds: the equal tempered kind
// which have a fixed pitch relative to the wheel (only their octave changes), and the just
// tempered kind which move relative to the wheel always.
type NoteSpec = {
    tempering: 'equal' | 'just'
    name: string
    level: number
    angle: number
}

// There are 12 equal tempered notes, which will all be at level zero (the outermost ring).
const equalTemperedNotes: NoteSpec[] = SCALE_LETTERS.map((name, i) => ({
    tempering: 'equal',
    name,
    level: 0,
    angle: i/12,
}))

// At the moment we are taking all of our just tempered notes from the harmonic series.
// If the fundamental is really happening two octaves down from our starting note, then
// this is the harmonic series starting from the 5th harmonic.
const justTemperedNotes: NoteSpec[] = [
    {ratio: 4/3, name: '4/3'},
    {ratio: 5/4, name: '5/4'},
    {ratio: 3/2, name: '3/2'},
    {ratio: 7/4, name: '7/4'},
    {ratio: 2, name: '8ve'},
    {ratio: 9/4, name: '9/4'},
    {ratio: 11/8, name: '11/8', level: 2},
].map(({name, ratio, level}) => ({
    tempering: 'just',
    name,
    level: level || 1,
    angle: Math.log2(ratio),
}))

const allNotes = [...equalTemperedNotes, ...justTemperedNotes]

/** Calculate the frequency a note should be played at. */
function noteFreq({tempering, angle}: NoteSpec, wheelAngle: number): number {
    let freqAngle = (tempering == 'equal') ? Math.ceil(wheelAngle - angle) + angle : wheelAngle + angle
    return C4_FREQ * Math.pow(2, freqAngle)
}

// Next some layout computations.

// pipeDims will be set to the width and height available to the pitch pipe SVG.
let pipeDims = {width: 0, height: 0}

// The vertical space the wedges take up.
$: outerRadius = Math.min(200, 0.45*pipeDims.width, 0.45*pipeDims.height)
$: radii = calcNoteRadii(outerRadius, [45, 35, 25])
function calcNoteRadii(outerRadius: number, noteHeights: number[]) {
    let radii = [outerRadius]
    for (let i = 1; i <= noteHeights.length; i++)
        radii[i] = radii[i-1] - noteHeights[i-1]

    return radii
}

/** Graph a function [-1, 1] to [-1, 1] as an SVG path in a [0, width] x [0, height] box. */
function graphAsPath(fn: (x: number) => number, width: number, height: number) {
    const resolution = 100
    let path = []
    for (let i = 0; i < resolution; i++) {
        path.push((i == 0) ? 'M' : 'L')
        let u = -1+i*2/resolution
        let v = fn(u)
        let x = (u+1)/2*width
        let y = (v+1)/2*height
        path.push(`${x}, ${y}`)
    }
    return path.join(' ')
}

/** Radial coordinates, where angles are in the range [0, 1]. */
function radial(angle: number, radius: number) {
    return `${radius * Math.cos(2*Math.PI*angle)},${radius * Math.sin(2 * Math.PI * angle)}`
}

/** Set up an audio context, with a frequency analyser, array to place analyser results. */
function setupAudio() {
    let ctx = new window.AudioContext()
    let analyserNode = new AnalyserNode(ctx, {
        fftSize: 4096 * 2,
    })
    let gainNode = new GainNode(ctx, {
        gain: 0.04,
    })
    gainNode.connect(ctx.destination)
    analyserNode.connect(gainNode)

    const dataArray = new Uint8Array(analyserNode.frequencyBinCount)

    return {
        ctx,
        analyserNode,
        destination: analyserNode,
        dataArray,
    }
}
const audio = setupAudio()




let playingNotes = new Map<NoteSpec, OscillatorNode>()
let playingNoteName = ''
function startNote(audio: {ctx: AudioContext, destination: AudioNode}, note: NoteSpec) {
    if (playingNotes.has(note))
        return

    if (playingNotes.size == 0 && note.tempering == 'equal')
        playingNoteName = pitchNotation(noteFreq(note, wheelAngle))

    let oscillatorNode = new OscillatorNode(audio.ctx, {
        type: waveSelected.type,
        frequency: noteFreq(note, wheelAngle),
    })
    oscillatorNode.connect(audio.destination)
    oscillatorNode.start()
    playingNotes.set(note, oscillatorNode)
    requestAnimationFrame(paintCanvas)
}
function releaseNote(audio: {ctx: AudioContext}, note: NoteSpec) {
    if (!playingNotes.has(note))
        return

    let oscillatorNode = playingNotes.get(note)
    oscillatorNode.stop(audio.ctx.currentTime)
    playingNotes.delete(note)

    if (playingNotes.size == 0)
        playingNoteName = ''
}


let canvasElt: HTMLCanvasElement

function paintCanvas() {
    let dpi = window.devicePixelRatio
    let width = canvasElt.clientWidth
    let height = canvasElt.clientHeight
    let pxWidth = Math.round(dpi * width)
    let pxHeight = Math.round(dpi * height)
    if (pxWidth != canvasElt.width || pxHeight != canvasElt.height) {
        canvasElt.width = pxWidth
        canvasElt.height = pxHeight
    }

    let ctx = canvasElt.getContext('2d')
    ctx.clearRect(0, 0, width, height)
    ctx.resetTransform()
    ctx.scale(dpi, dpi)

    let {dataArray} = audio
    audio.analyserNode.getByteFrequencyData(dataArray)

    // If we are done playing notes, and the frequencies in the buffer
    // have died back down, finish here. This means we're not doing any
    // requestAnimationFrames when there is nothing to draw.
    if (dataArray.every(x => x == 0) && playingNotes.size == 0 && !wheelMoving)
        return

    // The resolution of each spectral line.
    let hzStep = audio.ctx.sampleRate / audio.analyserNode.fftSize

    // Let's say we're only interested in plotting 4 octaves centered at the
    // tonal centre.
    let botBin = Math.floor(20 / hzStep)
    let midBin = Math.floor(C4_FREQ * Math.pow(2, wheelAngle) / hzStep)
    let topBin = Math.min(Math.floor(10000 / hzStep), dataArray.length)

    let graphMargin = 20

    let rectWidth = (width - 2*graphMargin) / (topBin - midBin)
    let graphBottom = 20
    ctx.save()
    ctx.scale(1, -1)
    ctx.translate(0, -height)
    ctx.fillStyle = '#818CF8'
    for (let i = botBin; i < topBin; i++) {
        ctx.fillRect(graphMargin + rectWidth * i, graphBottom, rectWidth, dataArray[i]/256*(height - graphBottom))
    }

    ctx.restore()
    ctx.fillStyle = 'white'
    ctx.strokeStyle = 'white'
    ctx.textAlign = 'center'
    let numTicks = 10
    for (let i = 0; i < numTicks; i++) {
        let bin = Math.floor((topBin - botBin) / numTicks * i)
        let freq = hzStep * (botBin + bin)
        let x = graphMargin + rectWidth * bin
        ctx.fillText(`${freq.toFixed(0)}`, graphMargin + rectWidth * bin, height - graphBottom*0.3)
        ctx.beginPath()
        ctx.moveTo(x, height - graphBottom*0.75)
        ctx.lineTo(x, height - graphBottom)
        ctx.stroke()
    }

    ctx.beginPath()
    ctx.moveTo(graphMargin + midBin * rectWidth, height - graphBottom*0.75)
    ctx.lineTo(graphMargin + midBin * rectWidth, height - graphBottom)
    ctx.fillText(`${(hzStep * midBin).toFixed(0)}`, graphMargin + rectWidth * midBin, height - graphBottom/16)
    ctx.stroke()

    requestAnimationFrame(paintCanvas)
}

let wheelAngle = 0
let cursorAngle = 0
let wheelToothAngleDelta = 1/12/2/4
let wheelMoving = false
let wheelMovingOscillator: OscillatorNode
function onPointerDown(event: PointerEvent) {
    this.setPointerCapture(event.pointerId)
    let {left, right, top, bottom} = this.getBoundingClientRect()
    let x = event.clientX - left - (right - left)/2
    let y = event.clientY - top - (bottom - top)/2

    cursorAngle = Math.atan2(y, x) / (2 * Math.PI)
    wheelMoving = true

    wheelMovingOscillator = new OscillatorNode(audio.ctx, {
        type: 'sine',
        frequency: C4_FREQ * Math.pow(2, wheelAngle)
    })
    wheelMovingOscillator.connect(audio.destination)
    wheelMovingOscillator.start()
    paintCanvas()
}
function onPointerUp(event: PointerEvent) {
    this.releasePointerCapture(event.pointerId)
    wheelMoving = false
    wheelMovingOscillator.stop()

    wheelAngle = Math.round(wheelAngle * 12) / 12
}
function onPointerMove(event: PointerEvent) {
    let {left, right, top, bottom} = this.getBoundingClientRect()
    let x = event.clientX - left - (right - left)/2
    let y = event.clientY - top - (bottom - top)/2
    let thisAngle = Math.atan2(y, x) / (2 * Math.PI)

    let angleDelta = ((thisAngle - cursorAngle) % 1 + 1) % 1
    wheelAngle += (angleDelta <= 0.5) ? angleDelta : angleDelta - 1
    wheelAngle = Math.max(Math.min(wheelAngle, 4), -2)
    cursorAngle = thisAngle

    wheelMovingOscillator.frequency.setTargetAtTime(
        C4_FREQ * Math.pow(2, wheelAngle),
        0,
        0.1
    )
}

let triangle = (x) => 2*Math.abs(2*(x-Math.floor(x+0.5))) - 1
type WaveSelectionType = {
    type: OscillatorType
    fn(x: number): number
}
const waveSelections: WaveSelectionType[] = [
    {type: 'sine', fn: (x) => Math.sin(10*x)},
    {type: 'sawtooth', fn: (x) => 2*((4*x) - Math.floor(4*x))-1},
    {type: 'triangle', fn: (x) => triangle(2*x)},
    {type: 'square', fn(x) {return Math.sign(Math.sin(10*x))}}
]
let waveSelected = waveSelections[1]
const waveDims = {width: 55, height: 18}
</script>

<style>
    .stroked { stroke: #818CF8; }

    .pitchpipe {width: 100%; height: 65%; }
    canvas {width: 100%; height: 15%; }
    svg.pitchsvg { width: 100%; height: 100%; }
    div { user-select: none; -webkit-user-select: none; }

    div.waves {
        margin: 0 auto;
        width: 100%;
        padding: 0 10px;
        display: flex;
        flex-direction: row;
        justify-content: center;
        flex-wrap: wrap;
    }
    div.waves > div {
        width: 70px;
        height: 40px;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    div.waves svg { width: 100%; height: 100%; padding: 10% 10%; }
    svg text {
        font-size: 12pt;
        fill: white;
        pointer-events: none; /* Allows click-through to underlying disk */
    }
    svg text.playing { font-size: 18pt; }
</style>

<div class="waves">
    {#each waveSelections as wave}
    <div class="wave" on:pointerdown={() => waveSelected = wave}>
        <svg>
            <path
                d={graphAsPath(wave.fn, 0.95*waveDims.width, 0.95*waveDims.height)}
                stroke="white"
                stroke-width={(wave == waveSelected) ? 2 : 1}
                fill="none"
                transform={`translate(${waveDims.width*0.025}, ${waveDims.height * 0.025})`}
                />
        </svg>
    </div>
    {/each}
</div>
<canvas bind:this={canvasElt} />
<div class="pitchpipe" bind:clientWidth={pipeDims.width} bind:clientHeight={pipeDims.height}>
    <svg class="pitchsvg">
        <g transform={`translate(${pipeDims.width/2}, ${pipeDims.height/2})`}>
            <circle
                cx="0"
                cy="0"
                r={outerRadius + 15}
                class="stroked"
                fill="grey"
                on:pointerdown={onPointerDown}
                on:pointerup={onPointerUp}
                on:pointermove={(wheelMoving) ? onPointerMove : null}
                />
            <circle cx="0" cy="0" r={outerRadius} class="stroked" fill="#1F2937" />

            {#each allNotes as note}
            <AnnularButton
                angle={(note.tempering == 'equal') ? note.angle : note.angle + wheelAngle}
                outerRadius={radii[note.level]}
                height={radii[note.level] - radii[note.level + 1]}
                name={note.name}
                startNote={() => startNote(audio, note)}
                releaseNote={() => releaseNote(audio, note)}
                />
            {/each}
            <path
                d={[
                    `M ${radial(wheelAngle + wheelToothAngleDelta, outerRadius+5)}`,
                    `L ${radial(wheelAngle, outerRadius - 10)}`,
                    `L ${radial(wheelAngle - wheelToothAngleDelta, outerRadius+5)}`,
                ].join(' ')}
                fill="grey" />
            <g transform={`rotate(${wheelAngle * 360})`}>
                {#each scalePositions as {text, angle}}
                    <text
                        text-anchor="middle"
                        dominant-baseline="middle"
                        transform={`translate(${radial(angle, outerRadius + 6)}) rotate(${360 * angle + 90})`}
                    >{text}</text>
                {/each}
            </g>
            <text text-anchor="middle" dominant-baseline="middle" class="playing">{playingNoteName}</text>
        </g>
    </svg>
</div>
