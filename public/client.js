window.range = n => [...Array(n).keys()]
window.colors = {
  Blue: '#68c3ffff',
  Red: '#ff9797ff',
  Green: '#8fff8eff',
  Purple: '#da97ffff',
  Yellow: '#ffffa3ff',
  None: 'white'
}

window.client = (() => {
  const range = window.range
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
    else console.warn('zoom complete')
    paper.panTo(800, 500, 200, null, function (err) {
      if (err) console.error(err)
      else console.warn('pan complete')
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
    if (component.data('type') !== 'screen') {
      screens[0].before(component)
      const id = component.data('id')
      const oldLayer = window.layers[id]
      window.layers[id] = Math.max(...window.layers) + 1
      window.layers = window.layers.map(layer => layer > oldLayer ? layer - 1 : layer)
    }
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
    const { x, y, rotation, type, clones, file, details, side, player, color } = description
    const template = templates[file]
    const startMatrix = template.transform().localMatrix.translate(x, y)
    range(clones + 1).forEach(i => {
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
      component.data('color', color)
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
        const plot = window.plots[description.cardId]
        const rectElement = component.children()[1].children()[1]
        rectElement.attr({ fill: window.colors[plot.color] })
        const rank1 = plot.rank === '1'
        const rankX = rank1 ? 25 : 50
        const rankY = rank1 ? 1050 : 1040
        const rankTextElement = group.text(rankX, rankY, plot.rank)
        rankTextElement.attr({ fontSize: 80 })
        rankTextElement.attr({ textAnchor: 'middle' })
        rankTextElement.attr({ fontFamily: 'sans-serif' })
        rankTextElement.attr({ fontWeight: 'bold' })
        component.add(rankTextElement)
        if (rank1) {
          const pawn = templates['card/pawn'].clone()
          component.append(pawn)
          pawn.node.style.display = 'block'
          pawn.transform('t15,940')
        }
        const buyBonus = plot.rank === '14' || plot.rank === '15'
        if (buyBonus) {
          const gold = templates['card/gold'].clone()
          component.append(gold)
          gold.node.style.display = 'block'
          gold.transform('t50,105')
        }
        if (description.time >= 1) {
          const hourglass = templates['card/hourglass'].clone()
          component.append(hourglass)
          hourglass.node.style.display = 'block'
          hourglass.transform('t0,-120')
        }
        if (description.time >= 2) {
          const hourglass = templates['card/hourglass'].clone()
          component.append(hourglass)
          hourglass.node.style.display = 'block'
          hourglass.transform('t35,-120')
        }
        if (description.time >= 3) {
          const hourglass = templates['card/hourglass'].clone()
          component.append(hourglass)
          hourglass.node.style.display = 'block'
          hourglass.transform('t70,-120')
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
    })
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
    const extraFiles = [
      'card/back', 'card/hidden', 'card/facedown', 'card/hourglass', 'card/gold',
      'board/screen-back', 'board/screen-hidden', 'board/screen-facedown',
      'board/ready-back', 'card/pawn'
    ]
    const files = unique(descriptions.map(item => item.file)).concat(extraFiles)
    files.forEach(file => {
      const template = setupTemplate(file, descriptions, msg, files.length)
      window.Snap.load(`assets/${file}.svg`, template)
    })
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
      // screens[0].before(component)
      window.bringToTop(component)
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
      components
        .map((val, id) => id)
        .sort((a, b) => window.layers[a] - window.layers[b])
        .filter(id => components[id].data('type') !== 'screen')
        .forEach(id => screens[0].before(components[id]))
    }
  }

  socket.on('connect', () => {
    console.warn('sessionid =', socket.id)

    socket.on('updateClient', msg => {
      if (msg.seed === seed) {
        console.log(msg)
        msg.updates.map(processUpdate)
        moveSlow = 300
      }
    })

    socket.on('setup', msg => {
      if (!seed) {
        seed = msg.seed
        Math.seedrandom(seed)
        console.warn('seed = ' + seed)
        window.plots = msg.plots
        window.setup(msg)
        paper.panTo(-500, 1100)
      } else {
        console.warn('Restart Needed')
      }
    })
  })

  return { describe, start, bits: components, on }
})()

window.annotateScheme = function (scheme) {
  return `<b>${scheme.title}</b><br><br>
    Color: ${scheme.color}<br><br>
    Time: ${scheme.time}<br><br>
    Rank: ${scheme.rank}<br><br>
    ${scheme.beginning}<br><br>
    ${scheme.end}<br><br>
    ${scheme.bonus && scheme.bonus !== '' ? `<strong>Bonus</strong>: ${scheme.bonus}<br><br>` : ''}
    <table>
      <tr>
        <td style="vertical-align: middle;">
          <img src="${scheme.icon1}" style="height: 16px" />
        </td>
        <td style="vertical-align: middle;">
          <a href="${scheme.link1}" target="_blank">${scheme.label1}</a>
        </td>
      </tr>
      <tr>
        <td style="vertical-align: middle;">
          <img src="${scheme.icon2}" style="height: 16px" />
        </td>
        <td style="vertical-align: middle;">
          <a href="${scheme.link2}" target="_blank">${scheme.label2}</a>
        </td>
      </tr>
    </table>
  `
}

const cursor = { x: 0, y: 0 }

function renderSchemeOverlay (eventName) {
  if (window.overDetails == null) {
    return
  }
  if (window.overDetails === window.schemeOverlayDetails) {
    return
  }
  if (window.schemeOverlay != null) {
    document.body.removeChild(window.schemeOverlay)
  }
  window.schemeOverlay = document.createElement('div')
  window.schemeOverlay.innerHTML = window.overDetails
  window.schemeOverlayDetails = window.overDetails
  window.schemeOverlay.style.position = 'absolute'

  window.schemeOverlay.style.zIndex = 1000
  window.schemeOverlay.style.padding = '10px'
  window.schemeOverlay.style.border = '1px solid black'
  window.schemeOverlay.style.borderRadius = '5px'
  window.schemeOverlay.style.fontSize = '20px'
  window.schemeOverlay.style.width = '350px'
  const background = window.colors[window.overColor]
  window.schemeOverlay.style.backgroundColor = background
  document.body.appendChild(window.schemeOverlay)
  const overRight = cursor.x + 175 > window.innerWidth
  if (overRight) {
    window.schemeOverlay.style.right = '0px'
  } else {
    const left = cursor.x - 175
    window.schemeOverlay.style.left = `${left}px`
  }
  const overTop = cursor.y - window.schemeOverlay.clientHeight < 0
  if (overTop) {
    window.schemeOverlay.style.top = '0px'
  } else {
    const bottom = window.innerHeight - cursor.y
    window.schemeOverlay.style.bottom = `${bottom}px`
  }
}

document.addEventListener('mousemove', e => {
  cursor.x = e.clientX
  cursor.y = e.clientY
  // saveCursorPosition(e.clientX, e.clientY)
  if (!window.spaceDown) {
    return
  }
  renderSchemeOverlay('mousemove')
})
document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    window.spaceDown = true
    renderSchemeOverlay('keydown')
  }
})
document.addEventListener('keyup', e => {
  if (e.code === 'Space') {
    window.spaceDown = false
    if (window.schemeOverlay != null) {
      document.body.removeChild(window.schemeOverlay)
      window.schemeOverlay = null
      window.schemeOverlayDetails = null
    }
  }
})
