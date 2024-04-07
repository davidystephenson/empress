
const detailDiv = document.getElementById('detail')
const hand1Div = document.getElementById('hand-1')
const hand2Div = document.getElementById('hand-2')
const hand3Div = document.getElementById('hand-3')
const hand4Div = document.getElementById('hand-4')
const hand5Div = document.getElementById('hand-5')
const hand6Div = document.getElementById('hand-6')

window.Snap.plugin(function (Snap, Element, Paper, global) {
  const cursor = { stacksOver: [] }

  const mouseClick = event => {
    //
  }

  const intersect = function (a, b) {
    return Snap.path.isBBoxIntersect(a.getBBox(), b.getBBox())
  }

  const getOverlapCardsCount = function (screen) {
    const allBits = screen.parent().children()
    const cards = allBits.filter(bit => bit.data('type') === 'card')
    const overlapCards = cards.filter(card => intersect(card, screen))
    return overlapCards.length
  }

  const isFrozen = bit => {
    const readyButtons = bit.parent().children().filter(x => x.data('file') === 'board/ready')
    const frozen = readyButtons.some(button => {
      if (button.data('side') !== 'front') {
        const screens = bit.parent().children().filter(x => x.data('file') === 'board/screen' && x.data('player') === button.data('player'))
        return screens.some(screen => intersect(bit, screen))
      }
      return false
    })
    return frozen
  }

  const siblings = a => a
    .parent()
    .children()

  const getStacksOver = (x, y) => {
    if (window.lastOver == null) return false
    const elements = siblings(window.lastOver)
    const stacks = elements.filter(a => a.data('type') === 'stack')
    return stacks.filter(stack => {
      const box = stack.node.getBoundingClientRect()
      const inX = box.left < x && x < box.right
      const inY = box.top < y && y < box.bottom
      return inX && inY
    })
  }

  window.preparePods = function (n) {
    if (cursor.stacksOver.length !== 1) return false
    const stack = cursor.stacksOver[0]
    const elements = siblings(window.lastOver)
    const cards = elements.filter(element => element.data('type') === 'card')
    const pods = cards.filter(card => card.data('rank') === 1)
    const podsInStack = pods.filter(pod => intersect(pod, stack))
    const drawnPods = podsInStack.slice(0, n)
    drawnPods.forEach((pod, index) => {
      select(pod)
      const y = 0
      const x = 50 * (drawnPods.length - index - 1)
      pod.transform(stack.transform().string + 't' + x + ',' + y)
      window.bringToTop(pod)
      window.flipComponent(pod)
      pod.data('moved', true)
    })
  }

  const isInStack = a => siblings(a)
    .filter(bit => ['deck', 'discard'].includes(bit.data('type')))
    .some(stack => intersect(a, stack))

  const getMyDeck = discard => siblings(discard)
    .filter(bit => bit.data('type') === 'deck' && bit.data('deckId') === discard.data('targetDeck'))[0]

  const getContents = stack => siblings(stack)
    .filter(bit => bit.data('type') === 'card' && intersect(stack, bit))

  const getDetails = bit => {
    return (bit.data('twoSided') && ['back', 'facedown'].includes(bit.data('side')))
      ? 'Hidden'
      : bit.data('details')
  }

  const getColor = bit => {
    return (bit.data('twoSided') && ['back', 'facedown'].includes(bit.data('side')))
      ? 'Hidden'
      : bit.data('color')
  }

  const select = (element) => {
    window.selected.push(element)
    element.data('ot', element.transform().local)
    window.setSelected(element, true)
    window.clickingGroup = true
  }

  const dragStart = function (x, y, event) {
    const controlDown = event.ctrlKey
    const shiftDown = event.shiftKey
    const groupSelect = event.button === 2 || (shiftDown && !controlDown)
    const move = event.button === 0 && !isFrozen(this) && !controlDown && ['card', 'bit'].includes(this.data('type'))
    const flip = (event.button === 0 && controlDown && this.data('twoSided')) ||
      (event.button === 1 && this.data('twoSided')) ||
      this.data('type') === 'screen'
    const inStack = isInStack(this)
    const cardOrBit = this.data('type') === 'card' || this.data('type') === 'bit'
    this.data('inStack', inStack)
    if (groupSelect && cardOrBit) {
      select(this)
    }
    if (window.selected.includes(this)) {
      window.clickingGroup = true
    }
    if (this.data('type') === 'card' & !inStack) {
      window.bringToTop(this)
    }
    if (this.data('file') === 'board/nametag') {
      const name = window.prompt('Please enter your name')
      const children = this.children()
      const textbox = children[children.length - 1]
      textbox.attr({ text: name })
      this.data('moved', true)
    }
    if (this.data('type') === 'discard') {
      const myDeck = getMyDeck(this)
      const myCards = getContents(this)
      myCards.sort((a, b) => window.layers[b.data('id')] - window.layers[a.data('id')])
      myCards.forEach((card, i) => {
        x = 0.5 * (myDeck.getBBox().width - card.getBBox().width)
        y = -0.5 * (myDeck.getBBox().height - card.getBBox().height) - 5
        card.transform(myDeck.transform().string + 't' + x + ',' + y)
        window.bringToTop(card)
        window.setSide(card, 'facedown')
        card.data('inStack', true)
        card.data('moved', true)
      })
    }
    if (move) {
      this.data('ot', this.transform().local)
      window.selected.forEach(element => {
        element.data('ot', element.transform().local)
      })
      this.data('dragging', true)
      this.data('rotating', false)
      this.data('moved', true)
    } else if (flip || this.data('type') === 'screen') {
      window.flipComponent(this)
      this.data('moved', true)
    }
  }

  function deselect () {
    window.selected.forEach(element => {
      window.setSelected(element, false)
    })
    window.selected = []
  }

  window.addEventListener('mousedown', event => {
    if (event.button === 0 && !event.ctrlKey && !event.shiftKey && !window.clickingGroup) {
      deselect()
    }
    window.clickingGroup = false
  })

  const mousemove = function (event) {
    cursor.stacksOver = getStacksOver(event.clientX, event.clientY)
  }

  function handleMouseout () {
    if (this.data('type') === 'card' && ['front', 'hidden'].includes(this.data('side'))) {
      window.overDetails = null
    }
  }

  const dragMove = function (dx, dy, event, x, y) {
    if (event.shiftKey) {
      return
    }
    if (this.data('dragging')) {
      const inStack = isInStack(this)
      if (!inStack) window.bringToTop(this)
      this.data('inStack', inStack)
      this.data('moved', true)
      if (this.data('type') === 'bit' || this.data('type') === 'card') {
        const snapInvMatrix = this.transform().diffMatrix.invert()
        snapInvMatrix.e = 0
        snapInvMatrix.f = 0
        const tdx = snapInvMatrix.x(dx, dy)
        const tdy = snapInvMatrix.y(dx, dy)
        this.transform(`t${tdx},${tdy}${this.data('ot')}`)
        window.selected.forEach(element => {
          const snapInvMatrix = element.transform().diffMatrix.invert()
          snapInvMatrix.e = 0
          snapInvMatrix.f = 0
          const tdx = snapInvMatrix.x(dx, dy)
          const tdy = snapInvMatrix.y(dx, dy)
          element.transform(`t${tdx},${tdy}${element.data('ot')}`)
          element.data('moved', true)
        })
      }
    }
  }

  const dragEnd = function (event) {
    this.data('dragging', false)
  }

  const mouseover = function () {
    window.lastOver = this
    if (this.data('type') === 'card' && ['front', 'hidden'].includes(this.data('side'))) {
      const details = getDetails(this)
      detailDiv.innerHTML = details
      window.overDetails = details
      const color = getColor(this)
      const background = window.colors[color]
      detailDiv.style.backgroundColor = background
      window.overColor = color
    }
  }

  const hover = function (event) {
  }

  // SVGSVGElement.getIntersectionList()  (from SVGSVGElement)
  // Element.hover    (from Snap.svg)
  document.addEventListener('mousemove', mousemove)

  let handIndex = 0
  const handDivs = [hand1Div, hand2Div, hand3Div, hand4Div, hand5Div, hand6Div]

  Element.prototype.smartdrag = function () {
    this.drag(dragMove, dragStart, dragEnd)
    this.mousedown(mouseClick)
    this.mouseover(mouseover)
    this.mouseout(handleMouseout)
    this.hover(hover)
    setTimeout(() => {
      const timeoutType = this.data('type')
      console.log('timeoutType', timeoutType)
      if (timeoutType === 'screen') {
        const handDiv = handDivs[handIndex]
        handIndex += 1
        setInterval(() => {
          if (this.data('type') === 'screen') {
            const overlapCardsCount = getOverlapCardsCount(this)
            handDiv.innerHTML = `The hand counts are: ${overlapCardsCount}`
          }
        }, 100)
      }
    }, 100)
    return this
  }
})
