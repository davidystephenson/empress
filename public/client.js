window.range = n => [...Array(n).keys()]

window.client = (() => {
  const range = window.range()
  const paper = window.Snap('#mysvg')
  const group = paper.group()

  const socket = window.io({ transports: ['websocket'], upgrade: false })
  const templates = {}
  const components = []
  const backs = []
  const hiddens = []
  const facedowns = []
  const handlers = {}

  let moveSlow = 10
  const screens = []

  let seed = null
  window.layers = []
  window.plots = []

  const unique = arr => {
    const s = new Set(arr)
    return [...s]
  }

  // Disable Right Click Menu
  document.oncontextmenu = () => false

  // Setup Zoom-Pan-Drag
  const paperError = (error, paper) => {
    if (error) console.error(error, paper)
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

  window.setSide = function (component, side) {
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
    if (oldside === 'back') window.setSide(component, 'front')
    if (oldside === 'facedown') window.setSide(component, 'hidden')
    if (oldside === 'front') window.setSide(component, 'hidden')
    if (oldside === 'hidden') window.setSide(component, 'front')
    component.data('moved', true)
  }

  window.bringToTop = function (component) {
    screens[0].before(component)
    const id = component.data('id')
    const oldLayer = window.layers[id]
    window.layers[id] = Math.max(...window.layers) + 1
    window.layers = window.layers.map(layer => layer > oldLayer ? layer - 1 : layer)
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
      const twoSided = ['card', 'screen'].includes(type) || file === 'board/ready'
      component.data('type', type)
      if (type === 'deck') component.data('deckId', description.deckId)
      if (type === 'discard') component.data('targetDeck', description.targetDeck)
      if (file === 'board/nametag') {
        const textbox = component.text(component.getBBox().width / 2, 760, 'Name Tag')
        textbox.attr({ 'font-size': 100, 'text-anchor': 'middle' })
      }

      function getTemplateString (name) {
        if (file === 'board/ready') {
          return 'board/ready-back'
        } else if (type === 'screen') {
          return `board/screen-${name}`
        } else {
          return `card/${name}`
        }
      }
      function getTemplate (name) {
        const string = getTemplateString(name)
        return templates[string].clone()
      }
      const hidden = getTemplate('hidden')
      const facedown = getTemplate('facedown')
      const back = getTemplate('back')
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
        const plot = window.plots[description.cardId]
        const rectElement = component.children()[1].children()[1]
        rectElement.attr({ fill: colors[plot.color] })
        const textElement = group.text(50, 1030, plot.rank)
        textElement.attr({ fontSize: 80 })
        textElement.attr({ 'text-anchor': 'middle' })
        textElement.attr({ 'font-family': 'sans-serif' })
        textElement.attr({ 'font-weight': 'bold' })
        component.add(textElement)
        if (description.time >= 1) {
          const hourglass = templates['card/hourglass'].clone()
          component.append(hourglass)
          hourglass.node.style.display = 'block'
          hourglass.transform('t0,10')
        }
        if (description.time >= 2) {
          const hourglass = templates['card/hourglass'].clone()
          component.append(hourglass)
          hourglass.node.style.display = 'block'
          hourglass.transform('t35,10')
        }
        if (description.time >= 3) {
          const hourglass = templates['card/hourglass'].clone()
          component.append(hourglass)
          hourglass.node.style.display = 'block'
          hourglass.transform('t70,10')
        }
      }
      if (type === 'screen') {
        component.data('type', 'screen')
        screens.push(component)
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

        if (side === 'facedown') window.setSide(component, 'facedown')
      }
    }
  }

  const setupTemplate = (file, descriptions, msg, numTemplates) => fragment => {
    const template = addFragment(fragment, 0, 0, 0)
    template.node.style.display = 'none'
    templates[file] = template
    if (Object.keys(templates).length === numTemplates) {
      descriptions.map(description => addComponent(description))
      window.layers = components.map((val, id) => id)
      msg.state.map(processUpdate)
      if (msg.layers.length > 0) updateLayers(msg.layers)
      screens.forEach((s, i) => i > 0 ? screens[0].after(s) : false)
      setInterval(updateServer, 300)
    }
  }

  const start = (descriptions, msg) => {
    const backFiles = [
      'card/back', 'card/hidden', 'card/facedown', 'card/hourglass',
      'board/screen-back', 'board/screen-hidden', 'board/screen-facedown',
      'board/ready-back'
    ]
    const files = unique(descriptions.map(item => item.file)).concat(backFiles)
    files.map(file => window.Snap.load(`assets/${file}.svg`, setupTemplate(file, descriptions, msg, files.length)))
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
          const oldLayer = window.layers[id]
          window.layers[id] = Math.max(...window.layers) + 1
          window.layers = window.layers.map(layer => layer > oldLayer ? layer - 1 : layer)
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
    msg.layers = window.layers
    msg.seed = seed
    if (msg.updates.length > 0) socket.emit('updateServer', msg)
  }

  const processUpdate = update => {
    if (update) {
      const component = components[update.id]
      component.stop()
      component.animate({ transform: update.local }, moveSlow)
      if (handlers.update) handlers.update(update)
      if (update.side === 'facedown') window.setSide(component, 'facedown')
      if (update.side === 'hidden') window.setSide(component, 'back')
      if (update.side === 'front') window.setSide(component, 'front')
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
    if (!arrayEquals(window.layers, newLayers)) {
      window.layers = newLayers
      console.log('update layers')
      components
        .map((val, id) => id)
        .sort((a, b) => window.layers[a] - window.layers[b])
        .filter(id => components[id].data('type') !== 'screen')
        .forEach(id => screens[0].before(components[id]))
    }
  }

  socket.on('connect', () => {
    console.log('sessionid =', socket.id)

    socket.on('updateClient', msg => {
      console.log('updateClient')
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
        window.plots = msg.plots
        window.setup(msg)
        paper.panTo(-500, 1100)
      } else {
        console.log('Restart Needed')
      }
    })
  })

  return { describe, start, bits: components, on }
})()
