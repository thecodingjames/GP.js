/** @module GP */

/** @class Gamepad */
class Gamepad {
  #native
  #lastState

  get id() {
    return `${this.#native.index}${this.#native.id}`
  }

  get buttons() {
    return this.#native.buttons
  }

  get axes() {
    return this.#native.axes
  }

  get state() {
    const processInputs = (entries, prop) => {
      return (
        Array.from(entries)
        .reduce((result, entry) => {
          result[entry[0]] = prop ? entry[1][prop] : entry[1] // Axes has raw value, buttons is an object with .pressed
          return result
        }, {})
      )
    }

    return {
        buttons: processInputs(this.buttons.entries(), 'pressed'),
        axes: processInputs(this.axes.entries())
    }
  }

  constructor(nativeGamepad) {
    this.#native = nativeGamepad
    this.#lastState = this.state
  }

  get changes() {
    const old = this.#lastState
    const current = this.state

    const changes = {
      state: {},
      [GP.Events.press]: [],
      [GP.Events.release]: [],
    }

    // Quick and dirty comparison, might refactor later
    if (JSON.stringify(old) != JSON.stringify(current)) {
      changes.state = current

      for (const [button, pressed] of Object.entries(current.buttons)) {
        if (old.buttons[button] != pressed) {
          const event = pressed ? GP.Events.press : GP.Events.release

          changes[event].push(button)
        }
      }

      this.#lastState = this.state

      return changes
    }

    return null
  }

  onInputs(callback) {
    gp.onInputs(callback, [ this ])
  }
}

class GP {

    static get Events() {
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
        return this.#gamepads
    }
    
    #subscribers = {
        [GP.Events.connect]: [],
        [GP.Events.disconnect]: [],
        [GP.Events.inputs]: [],
        [GP.Events.press]: [],
        [GP.Events.release]: [],
    }

    #gamepads = {}

    constructor() {
        window.addEventListener("gamepadconnected", (evt) => {
            const gamepad = new Gamepad(evt.gamepad)

            this.#gamepads[gamepad.id] = gamepad

            this.#broadcast(GP.Events.connect, gamepad)
        });

        window.addEventListener("gamepaddisconnected", (evt) => {
            const deletedGamepad = new Gamepad(evt.gamepad)

            delete this.#gamepads[deletedGamepad.id]

            this.#broadcast(GP.Events.disconnect, deletedGamepad)
        });

        requestAnimationFrame(this.listenForInputs.bind(this));
    }

    #subscribe(event, callback, context = {}) {
        this.#subscribers[event].push({ callback, ...context })
    }

    #broadcast(event, payload = undefined, predicate = () => true) {
        this.#subscribers[event]?.filter(predicate).forEach( ({ callback }) => callback(payload) )
    }

    onConnect(callback) {
      this.#subscribe(GP.Events.connect, callback)
    }

    onDisconnect(callback) {
      this.#subscribe(GP.Events.disconnect, callback)
    }

    onInputs(callback, gamepads = undefined) {
      if (gamepads) {
        gamepads.forEach((g) => {
          this.#subscribe(GP.Events.inputs, callback, { gamepad: g.id })
        })
      } else {
        this.#subscribe(GP.Events.inputs, callback)
      }
    }

    onPress(callback, buttons = undefined) {
      this.#onButtonEvent(GP.Events.press, callback, buttons)
    }

    onRelease(callback, buttons = undefined) {
      this.#onButtonEvent(GP.Events.release, callback, buttons)
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
      const inputs = Object.entries(this.#gamepads).reduce((acc, [id, gamepad]) => {
        const changes = gamepad.changes

        if (changes) {
          acc[id] = changes
        }

        return acc
      }, {})

      if (Object.keys(inputs).length > 0) {
          this.#broadcast(
            GP.Events.inputs, 
            inputs, 
            (context) => {
              return context.gamepad == undefined
            }
          )

          Object.entries(inputs).forEach(([id, changes]) => {
          
            this.#broadcast(
              GP.Events.inputs, 
              { gamepad: id, inputs: changes },
              (context) => {
                return context.gamepad == id
              }
            )

            const self = this;
            [GP.Events.press, GP.Events.release].forEach(event => {
              changes[event].forEach(button => {
                self.#broadcast(
                  event, 
                  { gamepad: id, button },
                  (context) => {
                      return context.button === undefined || context.button == button
                  }
                )
              })
            })

          })
      }

      requestAnimationFrame(this.listenForInputs.bind(this));
    }

    unsubscribe(callback, event = undefined) {
      const removeFilter = (fct) => (e) => e.callback != fct

      if (event) {
        const events = this.#subscribers[event]

        if (events === undefined) {
          console.error(`Invalid event: ${event}`)
        } else {
          this.#subscribers[event] = events.filter(removeFilter(callback))
        }

      } else {
        this.#subscribers = Object.fromEntries(
          Object.entries(this.#subscribers).map((e) => {
            const eventName = e[0]
            const eventCallbacks = e[1].filter(removeFilter(callback))

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
