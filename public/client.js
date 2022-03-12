/* global io, Snap */

window.client = (() => {
  const paper = Snap('#mysvg')
  const group = paper.group()

  const socket = io({ transports: ['websocket'], upgrade: false })
  const templates = {}
  const components = []
  const backs = []
  const hiddens = []
  const facedowns = []
  const handlers = {}

  let moveSlow = 10
  const screens = []
  let layers = []

  let seed = null
  let plots = null

  const unique = arr => {
    const s = new Set(arr)
    return [...s]
  }

  // Disable Right Click Menu
  document.oncontextmenu = () => false

  // Setup Zoom-Pan-Drag
  const paperError = (error, paper) => {
    console.log(error, paper)
  }
  paper.zpd({ zoom: true, pan: false, drag: false }, paperError)

  paper.zoomTo(0.2, 200, null, function (err) {
    if (err) console.error(err)
    else console.log('zoom complete')
    paper.panTo(800, 500, 200, null, function (err) {
      if (err) console.error(err)
      else console.log('pan complete')
    })
  })

  paper.mousedown(event => {
    if (event.button === 2) paper.zpd({ pan: true }, paperError)
  })

  paper.mouseup(event => {
    if (event.button === 2) paper.zpd({ pan: false }, paperError)
  })

  const setSide = function (component, side) {
    if (['card', 'screen'].includes(component.data('type'))) {
      const hidden = hiddens[component.data('hiddenId')]
      const back = backs[component.data('backId')]
      const facedown = facedowns[component.data('facedownId')]
      if (side === 'hidden') {
        back.attr({ opacity: 0 })
        hidden.attr({ opacity: 1 })
        facedown.attr({ opacity: 0 })
        back.node.style.display = 'none'
        hidden.node.style.display = 'block'
        facedown.node.style.display = 'none'
        component.data('side', 'hidden')
      }
      if (side === 'front') {
        back.attr({ opacity: 0 })
        hidden.attr({ opacity: 0 })
        facedown.attr({ opacity: 0 })
        back.node.style.display = 'none'
        hidden.node.style.display = 'none'
        facedown.node.style.display = 'none'
        component.data('side', 'front')
      }
      if (side === 'back') {
        back.attr({ opacity: 1 })
        hidden.attr({ opacity: 0 })
        facedown.attr({ opacity: 0 })
        back.node.style.display = 'block'
        hidden.node.style.display = 'none'
        facedown.node.style.display = 'none'
        component.data('side', 'back')
      }
      if (side === 'facedown') {
        back.attr({ opacity: 0 })
        hidden.attr({ opacity: 0 })
        facedown.attr({ opacity: 1 })
        back.node.style.display = 'none'
        hidden.node.style.display = 'none'
        facedown.node.style.display = 'block'
        component.data('side', 'facedown')
      }
    }
  }

  window.flipComponent = function (component) {
    const oldside = component.data('side')
    if (oldside === 'back') setSide(component, 'front')
    if (oldside === 'facedown') setSide(component, 'hidden')
    if (oldside === 'front') setSide(component, 'hidden')
    if (oldside === 'hidden') setSide(component, 'front')
    component.data('moved', true)
  }

  window.bringToTop = function (component) {
    screens[0].before(component)
    const id = component.data('id')
    const oldLayer = layers[id]
    layers[id] = Math.max(...layers) + 1
    layers = layers.map(layer => layer > oldLayer ? layer - 1 : layer)
  }

  const addFragment = (fragment, x, y, rotation) => {
    const svg = fragment.select('g')
    paper.append(svg)
    const children = paper.children()
    const component = children[children.length - 1]
    const width = component.getBBox().width
    const height = component.getBBox().height
    const startX = x - 0.5 * width
    const startY = y - 0.5 * height
    const startMatrix = component.transform().localMatrix.translate(startX, startY)
    startMatrix.rotate(rotation, width / 2, height / 2)
    component.transform(startMatrix)
    group.add(component)
    return component
  }

  const addComponent = (description) => {
    const { x, y, rotation, type, clones, file, details, side, player } = description
    const template = templates[file]
    const startMatrix = template.transform().localMatrix.translate(x, y)
    for (let i = 0; i <= clones; i++) {
      const component = template.clone()
      group.add(component)
      component.node.style.display = 'block'
      component.transform(startMatrix)
      component.transform(`${component.transform().local}r${rotation}`)
      components.push(component)
      component.smartdrag()
      component.data('id', components.length - 1)
      component.data('file', file)
      component.data('type', type)
      component.data('details', details)
      component.data('player', player)
      component.data('twoSided', false)
      component.data('inStack', false)
      let twoSided = false
      component.data('type', type)
      if (type === 'deck') component.data('deckId', description.deckId)
      if (type === 'discard') component.data('targetDeck', description.targetDeck)
      if (file === 'board/nametag') {
        const textbox = component.text(component.getBBox().width / 2, 760, 'Name Tag')
        textbox.attr({ 'font-size': 100, 'text-anchor': 'middle' })
      }
      let hidden = templates['card/hidden'].clone()
      let facedown = templates['card/facedown'].clone()
      let back = templates['card/back'].clone()
      if (type === 'card') {
        component.data('type', 'card')
        const colors = {
          Blue: '#68c3ffff',
          Red: '#ff9797ff',
          Green: '#8fff8eff',
          Purple: '#da97ffff',
          Yellow: '#ffffa3ff',
          None: 'white'
        }
        const plot = plots[description.cardId]
        const rectElement = component.children()[1].children()[1]
        rectElement.attr({ fill: colors[plot.color] })
        const textElement = group.text(50, 1030, plot.rank)
        textElement.attr({ fontSize: 80 })
        textElement.attr({ 'text-anchor': 'middle' })
        textElement.attr({ 'font-family': 'sans-serif' })
        textElement.attr({ 'font-weight': 'bold' })
        component.add(textElement)
        twoSided = true
      }
      if (type === 'screen') {
        component.data('type', 'screen')
        hidden = templates['board/screen-hidden'].clone()
        facedown = templates['board/screen-facedown'].clone()
        back = templates['board/screen-back'].clone()
        twoSided = true
        screens.push(component)
      }
      if (file === 'board/ready') {
        hidden = templates['board/ready-back'].clone()
        facedown = templates['board/ready-back'].clone()
        back = templates['board/ready-back'].clone()
        twoSided = true
      }
      if (twoSided) {
        component.data('twoSided', true)
        component.data('side', 'front')

        hiddens.push(hidden)
        component.data('hiddenId', hiddens.length - 1)
        group.add(hidden)
        hidden.node.style.display = 'block'
        component.append(hidden)
        hidden.node.style.display = 'none'
        hidden.attr({ opacity: 0 })
        hidden.transform('')
        hidden.data('details', 'Hidden')

        facedowns.push(facedown)
        component.data('facedownId', facedowns.length - 1)
        group.add(facedown)
        facedown.node.style.display = 'block'
        component.append(facedown)
        facedown.node.style.display = 'none'
        facedown.attr({ opacity: 0 })
        facedown.transform('')
        facedown.data('details', 'Facedown')

        backs.push(back)
        component.data('backId', backs.length - 1)
        group.add(back)
        back.node.style.display = 'block'
        component.append(back)
        back.node.style.display = 'none'
        back.attr({ opacity: 0 })
        back.transform('')
        back.data('details', 'Back')

        if (side === 'facedown') setSide(component, 'facedown')
      }
    }
  }

  const setupTemplate = (file, descriptions, msg, numTemplates) => fragment => {
    const template = addFragment(fragment, 0, 0, 0)
    template.node.style.display = 'none'
    templates[file] = template
    if (Object.keys(templates).length === numTemplates) {
      descriptions.map(description => addComponent(description))
      layers = components.map((val, id) => id)
      msg.state.map(processUpdate)
      if (msg.layers.length > 0) updateLayers(msg.layers)
      screens.forEach((s, i) => i > 0 ? screens[0].after(s) : false)
      setInterval(updateServer, 300)
    }
  }

  const start = (descriptions, msg) => {
    console.log(msg)
    let files = unique(descriptions.map(item => item.file))
    const backFiles = [
      'card/back', 'card/hidden', 'card/facedown',
      'board/screen-back', 'board/screen-hidden', 'board/screen-facedown',
      'board/ready-back'
    ]
    files = files.concat(backFiles)
    files.map(file => Snap.load(`assets/${file}.svg`, setupTemplate(file, descriptions, msg, files.length)))
  }

  const describe = options => {
    const description = { file: null, x: 0, y: 0, type: 'bit', clones: 0, rotation: 0 }
    return Object.assign(description, options)
  }

  const on = (name, handler) => (handlers[name] = handler)

  const updateServer = () => {
    const msg = { updates: [], layers: [] }
    components.forEach(component => {
      if (component.data('moved')) {
        const id = component.data('id')
        const inStack = component.data('inStack')
        if (!inStack) {
          const oldLayer = layers[id]
          layers[id] = Math.max(...layers) + 1
          layers = layers.map(layer => layer > oldLayer ? layer - 1 : layer)
        }
        const bitUpdate = {
          id: component.data('id'),
          side: component.data('side'),
          local: component.transform().local,
          inStack: component.data('inStack')
        }
        if (component.data('file') === 'board/nametag') {
          const children = component.children()
          const textbox = children[children.length - 1]
          bitUpdate.text = textbox.attr('text')
        }
        if (handlers.moved) {
          Object.assign(bitUpdate, handlers.moved(component))
        }
        msg.updates.push(bitUpdate)
        component.data('moved', false)
      }
    })
    msg.layers = layers
    if (msg.updates.length > 0) socket.emit('updateServer', msg)
  }

  const processUpdate = update => {
    if (update) {
      const component = components[update.id]
      component.stop()
      component.animate({ transform: update.local }, moveSlow)
      if (handlers.update) handlers.update(update)
      if (update.side === 'facedown') setSide(component, 'facedown')
      if (update.side === 'hidden') setSide(component, 'back')
      if (update.side === 'front') setSide(component, 'front')
      if (component.data('file') === 'board/nametag') {
        const children = component.children()
        const textbox = children[children.length - 1]
        textbox.attr({ text: update.text })
      }
    }
  }

  const arrayEquals = (a, b) => {
    return Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((val, index) => val === b[index])
  }

  const updateLayers = function (newLayers) {
    if (!arrayEquals(layers, newLayers)) {
      layers = newLayers
      console.log('update layers')
      let ids = components.map((val, id) => id)
      ids.sort((a, b) => layers[a] - layers[b])
      ids = ids.filter(id => components[id].data('type') !== 'screen')
      ids.map(id => screens[0].before(components[id]))
    }
  }

  socket.on('connect', () => {
    console.log('sessionid =', socket.id)

    socket.on('updateClient', msg => {
      if (msg.seed === seed) {
        updateLayers(msg.layers)
        msg.updates.map(processUpdate)
        moveSlow = 300
      }
    })

    socket.on('setup', msg => {
      if (!seed) {
        seed = msg.seed
        Math.seedrandom(seed)
        console.log('seed = ' + seed)
        plots = msg.plots
        window.setup(msg)
        paper.panTo(-500, 1100)
      } else {
        console.log('Restart Needed')
      }
    })
  })

  return { describe, start, bits: components, on }
})()
