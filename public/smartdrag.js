const detailDiv = document.getElementById('detail')

window.Snap.plugin(function (Snap, Element, Paper, global) {
  const mouseClick = event => {
    //
  }

  const intersect = function (a, b) {
    return Snap.path.isBBoxIntersect(a.getBBox(), b.getBBox())
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

  const dragStart = function (x, y, event) {
    console.log('dragStart', event)
    const controlDown = event.ctrlKey
    const shiftDown = event.shiftKey
    const groupSelect = event.button === 0 && shiftDown && !controlDown
    const move = event.button === 0 && !isFrozen(this) && !controlDown && ['card', 'bit'].includes(this.data('type'))
    const flip = (event.button === 0 && controlDown && this.data('twoSided')) ||
      (event.button === 1 && this.data('twoSided')) ||
      this.data('type') === 'screen'
    const inStack = isInStack(this)
    const cardOrBit = this.data('type') === 'card' || this.data('type') === 'bit'
    this.data('inStack', inStack)
    if (groupSelect && cardOrBit) {
      window.selected.push(this)
      this.data('ot', this.transform().local)
      window.setSelected(this, true)
      console.log('dragStart', window.selected)
      window.deselecting = false
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
      console.log("myDeck.data('deckId')", myDeck.data('deckId'))
      console.log("this.data('targetDeck')", this.data('targetDeck'))
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
      window.groupMoved = 0
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
    window.groupMoved = 0
  }

  window.addEventListener('mousedown', event => {
    console.log('mousedown', event)
    if (event.button === 0 && !event.ctrlKey && !event.shiftKey && window.deselecting) {
      console.log('deselecting')
      // deselect()
    }
  })

  const mouseover = function () {
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

  function handleMouseout () {
    if (this.data('type') === 'card' && ['front', 'hidden'].includes(this.data('side'))) {
      window.overDetails = null
    }
  }

  const dragMove = function (dx, dy, event, x, y) {
    if (this.data('dragging')) {
      const inStack = isInStack(this)
      if (!inStack) window.bringToTop(this)
      this.data('inStack', inStack)
      this.data('moved', true)
      if (this.data('type') === 'bit' || this.data('type') === 'card') {
        window.groupMoved += Math.abs(dx) + Math.abs(dy)
        console.log('dragMove')
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
    if (window.groupMoved) {
      // window.selected.forEach(element => {
      //   window.setSelected(element, false)
      // })
      // window.selected = []
      window.groupMoved = 0
    }
    console.log('dragEnd', window.selected)
  }

  Element.prototype.smartdrag = function () {
    this.drag(dragMove, dragStart, dragEnd)
    this.mousedown(mouseClick)
    this.mouseover(mouseover)
    this.mouseout(handleMouseout)
    return this
  }
})
