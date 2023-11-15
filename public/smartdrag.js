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
    const shiftDown = event.shiftKey
    const ctrlDown = event.ctrlKey
    const move = event.button === 0 && !isFrozen(this) && !shiftDown && !ctrlDown && ['card', 'bit'].includes(this.data('type'))
    const flip = (event.button === 0 && shiftDown && this.data('twoSided')) ||
      (event.button === 1 && this.data('twoSided')) ||
      this.data('type') === 'screen'
    const turnDown = event.button === 0 && ctrlDown && this.data('twoSided')
    const inStack = isInStack(this)
    this.data('inStack', inStack)
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
      this.data('dragging', true)
      this.data('rotating', false)
      this.data('moved', true)
    } else if (flip || this.data('type') === 'screen') {
      window.flipComponent(this)
      this.data('moved', true)
    } else if (turnDown) {
      window.setSide(this, 'facedown')
      this.data('moved', true)
    }
  }

  const mouseover = function () {
    if (this.data('type') === 'card' && ['front', 'hidden'].includes(this.data('side'))) {
      const details = getDetails(this)
      detailDiv.innerHTML = details
      window.overDetails = details
      const color = getColor(this)
      window.overColor = color
    }
  }

  function handleMouseout () {
    if (this.data('type') === 'card' && ['front', 'hidden'].includes(this.data('side'))) {
      window.overScheme = null
    }
  }

  const dragMove = function (dx, dy, event, x, y) {
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
      }
    }
  }

  const dragEnd = function () {
    this.data('dragging', false)
  }

  Element.prototype.smartdrag = function () {
    this.drag(dragMove, dragStart, dragEnd)
    this.mousedown(mouseClick)
    this.mouseover(mouseover)
    this.mouseout(handleMouseout)
    return this
  }
})
