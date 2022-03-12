/* global Snap */

const detailDiv = document.getElementById('detailDiv')

Snap.plugin(function (Snap, Element, Paper, global) {
  let shiftDown = false
  let ctrlDown = false

  const mouseClick = event => {
    // console.log("mouseClick")
  }

  const intersect = function (a, b) {
    return Snap.path.isBBoxIntersect(a.getBBox(), b.getBBox())
  }

  const isFrozen = bit => {
    readyButtons = bit.parent().children().filter(x => x.data('file') == 'board/ready')
    frozen = false
    readyButtons.forEach(button => {
      if (button.data('side') != 'front') {
        screens = bit.parent().children().filter(x => x.data('file') == 'board/screen' && x.data('player') == button.data('player'))
        screens.forEach(screen => frozen = frozen || intersect(bit, screen))
      }
    })
    return (frozen)
  }

  const isInStack = function (a) {
    stacks = a.parent().children().filter(bit => ['deck', 'discard'].includes(bit.data('type')))
    inStack = false
    stacks.forEach(stack => { inStack = inStack || intersect(a, stack) })
    return inStack
  }

  const getMyDiscard = function (deck) {
    discards = deck.parent().children().filter(bit => bit.data('type') == 'discard')
    return discards.filter(discard => discard.data('targetDeck') == deck.data('deckId'))[0]
  }

  const getMyDeck = function (discard) {
    decks = discard.parent().children().filter(bit => bit.data('type') == 'deck')
    return decks.filter(deck => deck.data('deckId') == discard.data('targetDeck'))[0]
  }

  const getContents = function (stack) {
    cards = stack.parent().children().filter(bit => bit.data('type') == 'card')
    myCards = cards.filter(card => intersect(stack, card))
    return (myCards)
  }

  const isEmpty = function (deck) {
    return getContents(deck).length == 0
  }

  const getDetails = function (bit) {
    text = ''
    if (!bit.data('twoSided') || ['front', 'hidden'].includes(bit.data('side'))) {
      text = bit.data('details')
    } else {
      text = 'Hidden'
    }
    return (text)
  }

  const dragStart = function (x, y, event) {
    const move = event.button === 0 && !isFrozen(this) && !shiftDown && !ctrlDown && ['card', 'bit'].includes(this.data('type'))
    let flip = event.button === 0 && shiftDown && this.data('twoSided')
    flip = flip || event.button === 1 && this.data('twoSided')
    flip = flip || this.data('type') == 'screen'
    const turnDown = event.button === 0 && ctrlDown && this.data('twoSided')
    inStack = isInStack(this)
    this.data('inStack', inStack)
    detailDiv.innerHTML = getDetails(this)
    if (this.data('type') == 'card' & !inStack) {
      bringToTop(this)
    }
    if (this.data('file') == 'board/nametag') {
      const name = prompt('Please enter your name')
      const children = this.children()
      const textbox = children[children.length - 1]
      console.log(textbox.attr({ text: name }))
      this.data('moved', true)
    }
    if (this.data('type') == 'discard') {
      myDeck = getMyDeck(this)
      myCards = getContents(this)
      myCards.sort((a, b) => layers[b.data('id')] - layers[a.data('id')])
      myCards.forEach((card, i) => {
        x = 0.5 * (myDeck.getBBox().width - card.getBBox().width)
        y = -0.5 * (myDeck.getBBox().height - card.getBBox().height) + 50
        card.transform(myDeck.transform().string + 't' + x + ',' + y)
        bringToTop(card)
        setSide(card, 'facedown')
        card.data('inStack', true)
        card.data('moved', true)
      })
    }
    if (this.data('type') == 'deck') {
      console.log('flipDeck')
      myDiscard = getMyDiscard(this)
      myCards = getContents(this)
      myCards.sort((a, b) => layers[b.data('id')] - layers[a.data('id')])
      myCards.forEach((card, i) => {
        x = 0.5 * (myDiscard.getBBox().width - card.getBBox().width)
        y = -0.5 * (myDiscard.getBBox().height - card.getBBox().height) + 50
        card.transform(myDiscard.transform().string + 't' + x + ',' + y)
        bringToTop(card)
        setSide(card, 'front')
        card.data('inStack', true)
        card.data('moved', true)
      })
    }
    if (move) {
      this.data('ot', this.transform().local)
      this.data('dragging', true)
      this.data('rotating', false)
      this.data('moved', true)
    } else if (flip || this.data('type') == 'screen') {
      flipComponent(this)
      this.data('moved', true)
    } else if (turnDown) {
      setSide(this, 'facedown')
      this.data('moved', true)
    }
  }

  const dragMove = function (dx, dy, event, x, y) {
    if (this.data('dragging')) {
      inStack = isInStack(this)
      if (!inStack) bringToTop(this)
      this.data('inStack', inStack)
      this.data('moved', true)
      if (this.data('type') == 'bit' || this.data('type') == 'card') {
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

  this.onkeydown = event => {
    if (event.key === 'Shift') shiftDown = true
    if (event.key == 'Control') ctrlDown = true
  }

  this.onkeyup = event => {
    if (event.key === 'Shift') shiftDown = false
    if (event.key == 'Control') ctrlDown = false
  }

  Element.prototype.smartdrag = function () {
    this.drag(dragMove, dragStart, dragEnd)
    this.mousedown(mouseClick)
    return this
  }
})
