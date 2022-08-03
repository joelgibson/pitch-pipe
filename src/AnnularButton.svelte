<!--
    An AnnularButton knows how to draw itself, listen for pointer events, and call two provided functions
    for when the note should be started and released. On a touch device, many notes can be held at once,
    while on a single pointer device, the shift key can be held down to get multiple notes at once.
-->

<script lang="ts">
    export let angle: number
    export let outerRadius: number
    export let height: number
    export let name: string
    export let startNote: () => void
    export let releaseNote: () => void
    let angleWidth = 1 / 12

    function radial(angle: number, radius: number) {
        return `${radius * Math.cos(2 * Math.PI * angle)},${radius * Math.sin(2 * Math.PI * angle)}`
    }

    $: innerRadius = outerRadius - height
    $: sectorPath = [
        `M ${radial(angle-angleWidth/2, innerRadius)}`,
        `L ${radial(angle-angleWidth/2, outerRadius)}`,
        `A ${outerRadius} ${outerRadius} 0 0 1 ${radial(angle+angleWidth/2, outerRadius)}`,
        `L ${radial(angle+angleWidth/2, innerRadius)}`,
        `A ${innerRadius} ${innerRadius} 0 0 0 ${radial(angle-angleWidth/2, innerRadius)}`,
        `Z`,
    ].join(' ')
    $: textTrans = `translate(${radial(angle, (innerRadius+outerRadius)/2)}) rotate(${90+360*angle})`


    // inactive: nothing interesting.
    // hold: pointer has started being held down, but the shift key was inactive at the time.
    // sustain: pointer has started being held down, and the shift key was active at the time.
    type State = 'inactive' | 'hold' | 'sustain'
    let state: State = 'inactive'
    let isHovered: boolean = false

    function onPointerDown(e: PointerEvent) {
        this.setPointerCapture(e.pointerId)
        if (state == 'inactive') {

            startNote()
            state = (e.shiftKey) ? 'sustain' : 'hold'
        } else if (state == 'sustain') {
            releaseNote()
            state = 'inactive'
        }
    }
    function onPointerUp(e: PointerEvent) {
        this.releasePointerCapture(e.pointerId)
        if (state == 'hold') {
            releaseNote()
            state = 'inactive'
        }
    }
    function onKeyUp(e: KeyboardEvent) {
        if (e.key == 'Shift' && state == 'sustain') {
            releaseNote()
            state = 'inactive'
        }
    }

    function cancel() {
        if (state != 'inactive') {
            releaseNote()
            state = 'inactive'
        }
    }

    function releaseSustain() {
        if (state == 'sustain') {
            releaseNote()
            state = 'inactive'
        }
    }
</script>

<!--
    Using on:blur={cancel} here really messes things up on the iPhone, I think because touches often go off the edge.
    Only cancelling sustain instead seems to work a lot better, since we only expect sustain to be used on non-touch devices.
-->
<svelte:window on:keyup={onKeyUp} on:blur={releaseSustain}/>

<style>
    .stroked { stroke: #818CF8; }
    .active { fill: #aaa; }
    text { font-family: Arial, sans-serif; font-size: 16pt; fill: white; }
</style>

<path
    d={sectorPath}
    class="stroked"
    class:active={isHovered}
    fill="none"
    />
<text
    transform={textTrans}
    text-anchor="middle"
    dominant-baseline="middle"
>
    {name}
</text>
<path
    d={sectorPath}
    fill="#00000000"
    stroke="none"
    on:pointerdown={onPointerDown}
    on:pointerenter={() => isHovered = true}
    on:pointerleave={() => isHovered = false}
    on:pointerup={onPointerUp}
    on:pointercancel={cancel}
    />
