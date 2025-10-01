class GP {

    get Events() {
      const events = [
        'connect',
        'disconnect',
        'inputs',
        'press',
        'release'
      ]

      const enumerated = {}
      events.forEach(e => enumerated[e] = e)
      
      return Object.freeze(enumerated)
    }

    get gamepads() {
        return navigator.getGamepads()
    }
    
    #subscribers = {
        [this.Events.connect]: [],
        [this.Events.disconnect]: [],
        [this.Events.inputs]: [],
        [this.Events.press]: [],
        [this.Events.release]: [],
    }

    #states = {}

    constructor() {
        window.addEventListener("gamepadconnected", (evt) => {
            const gamepad = evt.gamepad

            this.#states[gamepad.id] = this.#gamepadState(gamepad)

            this.#broadcast(this.Events.connect, gamepad)
        });

        window.addEventListener("gamepaddisconnected", (evt) => {
            const gamepad = evt.gamepad

            const { [gamepad.id]: deleted, ...kept } = this.#states
            this.#states = kept

            this.#broadcast(this.Events.disconnect, gamepad)
        });

        requestAnimationFrame(this.listenForInputs.bind(this));
    }

    #subscribe(event, callback, context = {}) {
        this.#subscribers[event].push({ callback, ...context })
    }

    #broadcast(event, payload = undefined, predicate = () => true) {
        this.#subscribers[event]?.filter(predicate).forEach( ({ callback }) => callback(payload) )
    }

    #gamepadState(gamepad) {
        const state = {
            buttons: {},
            axes: {},
        }

        for (const [i, button] of gamepad.buttons.entries()) {
            state.buttons[i] = button.pressed
        }

        for (const [i, axis] of gamepad.axes.entries()) {
            state.axes[i] = axis
        }

        return state
    }

    onConnect(callback) {
        this.#subscribe(this.Events.connect, callback)
    }

    onDisconnect(callback) {
        this.#subscribe(this.Events.disconnect, callback)
    }

    onInputs(callback) {
        this.#subscribe(this.Events.inputs, callback)
    }

    onPress(callback, buttons = undefined) {
        this.#onButtonEvent(this.Events.press, callback, buttons)
    }

    onRelease(callback, buttons = undefined) {
        this.#onButtonEvent(this.Events.release, callback, buttons)
    }

    #onButtonEvent(event, callback, buttons) {
        if (buttons) {
            buttons.forEach((b)=> {
                this.#subscribe(event, callback, { button: b })
            })
        } else {
            this.#subscribe(event, callback, { button: undefined })
        }
    }

    listenForInputs() {
        const inputs = {}

        for (const gamepad of this.gamepads) {
            if (!gamepad) {
                continue;
            }

            const oldState = this.#states[gamepad.id]
            const newState = this.#gamepadState(gamepad) 

            if (JSON.stringify(oldState) != JSON.stringify(newState)) {
                inputs[gamepad.id] = newState     
            }
        }

        if (Object.keys(inputs).length > 0) {
            this.#broadcast(this.Events.inputs, inputs)

            for (const [gamepadId, newState] of Object.entries(inputs)) {
                const oldState = this.#states[gamepadId] 

                for (const [button, pressed] of Object.entries(newState.buttons)) {
                    if (oldState.buttons[button] != pressed) {
                        const event = pressed ? this.Events.press : this.Events.release

                        this.#broadcast(
                            event, 
                            { button },
                            (eventData) => {
                                return eventData.button === undefined || eventData.button == button
                            }
                        )
                    }
                }

                this.#states[gamepadId] = newState
            }
        }

        requestAnimationFrame(this.listenForInputs.bind(this));
    }

    unsubscribe(callback, event = undefined) {
        if (event) {
            const events = this.#subscribers[event]

            if (events === undefined) {
                console.error(`Invalid event: ${event}`)
            } else {
                this.#subscribers[event] = events.filter((e) => e != callback)
            }

        } else {
            this.#subscribers = Object.fromEntries(
                Object.entries(this.#subscribers).map((e) => {
                    const eventName = e[0]
                    const eventCallbacks = e[1].filter((e) => e != callback)

                    return [
                        eventName,
                        eventCallbacks
                    ]
                })
            )
        }
    }
}

const gp = new GP()

export default gp
