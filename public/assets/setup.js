const range = window.range

const getRowOrigins = (n, y, tableWidth) => window.range(n).map(i => {
  const alpha = (i + 1) / (n + 1)
  const x = -tableWidth * alpha + tableWidth * (1 - alpha)
  return [x, y]
})

const shuffle = array => array
  .map(item => ({ value: item, priority: Math.random() }))
  .sort((a, b) => a.priority - b.priority)
  .map(x => x.value)

const describeRow = (file, x, y, type, n, length, side = 'front') => range(n).map(i => {
  const alpha = n > 1 ? i / (n - 1) : 0
  const myX = (x - 0.5 * length) * (1 - alpha) + (x + 0.5 * length) * alpha
  return window.client.describe({ file, x: myX, y, type, side })
})

const describePortfolio = (x, y, playerIndex) => {
  const sgn = Math.sign(y)
  const angle = sgn === -1 ? 180 : 0
  const boards = [
    window.client.describe({ file: 'board/nametag', x: x, y: y + sgn * 750, type: 'board' }),
    window.client.describe({ file: 'board/screen', x: x, y: y + sgn * 500, type: 'screen', rotation: angle, player: playerIndex }),
    window.client.describe({ file: sgn === 1 ? 'board/tableau-bottom' : 'board/tableau-top', x: x, y: y - sgn * 200, type: 'board' }),
    window.client.describe({ file: 'board/stack', x: x + 730, y: y - sgn * 50, type: 'stack' })
  ]
  const hand = deal.handIds.map((handId, i) => {
    const space = 160
    return window.client.describe({
      file: 'card/front',
      x: x + (i - 2) * space,
      y: y + sgn * 500,
      type: 'card',
      cardId: handId
    })
  })
  const reserve = deal.reserveIds.map((reserveId, i) => {
    const space = 160
    return window.client.describe({
      file: 'card/front',
      x: x + (i - 3) * space,
      y: y - sgn * 50,
      type: 'card',
      cardId: reserveId
    })
  })
  const gold = [
    ...describeRow('gold/5', x - 250, y + sgn * 225, 'bit', 4, 320),
    ...describeRow('gold/10', x + 250, y + sgn * 225, 'bit', 3, 240)
  ]
  const villages = [
    window.client.describe({ file: 'card/front', x: x + 730, y: y - sgn * 50, type: 'card', cardId: 1, clones: 50 })
  ]
  const descriptions = [...boards, ...hand, ...reserve, ...gold, ...villages]
  return descriptions
}

const describeBank = (x, y) => [
  window.client.describe({ file: 'gold/1', x: x - 280, y: y - 120, type: 'bit', clones: 150 }),
  window.client.describe({ file: 'gold/1', x: x - 280, y: y + 120, type: 'bit', clones: 150 }),
  window.client.describe({ file: 'gold/5', x: x - 120, y: y - 120, type: 'bit', clones: 35 }),
  window.client.describe({ file: 'gold/5', x: x - 120, y: y + 120, type: 'bit', clones: 35 }),
  window.client.describe({ file: 'gold/10', x: x + 60, y: y - 120, type: 'bit', clones: 30 }),
  window.client.describe({ file: 'gold/10', x: x + 60, y: y + 120, type: 'bit', clones: 30 }),
  window.client.describe({ file: 'gold/25', x: x + 260, y: y - 120, type: 'bit', clones: 15 }),
  window.client.describe({ file: 'gold/25', x: x + 260, y: y + 120, type: 'bit', clones: 15 })
]

const describeCourt = (x, y) => {
  return [
    window.client.describe({ file: 'board/court', x: x, y: 0, type: 'board' }),
    window.client.describe({ file: 'card/front', x: x, y: y - 150, type: 'card', cardId: deal.courtId }),
    window.client.describe({ file: 'card/front', x: x, y: y + 150, type: 'card', cardId: deal.dungeonId })
  ]
}

const annotate = function (description) {
  description.details = ''
  if (description.type === 'card') {
    const plot = window.plots[description.cardId]
    description.time = plot.time
    description.color = plot.color
    description.details = window.annotateScheme(plot)
  }
}

const getLayer = element => {
  switch (element.type) {
    case 'board': return 1
    case 'card': return 2
    case 'bit': return 3
    case 'screen': return 4
    default: return 0
  }
}

const compareLayers = (a, b) => {
  const aLayer = getLayer(a)
  const bLayer = getLayer(b)
  return aLayer - bLayer
}

const deal = {}

const setupCards = (msg, numPlayers) => {
  console.log('msg.plots', msg.plots)
  const shuffledIds = shuffle([...Array(window.plots.length).keys()].filter(i => i !== 5 && i !== 1))
  console.log('shuffle', shuffledIds)
  deal.empressIds = shuffledIds.slice(0, numPlayers + 13)
  console.log('empressIds', deal.empressIds)
  deal.empressIds.sort((a, b) => a - b)
  deal.courtId = deal.empressIds.shift()
  deal.timelineLength = numPlayers + 5
  const green = deal.empressIds.filter(i => msg.plots[i].color === 'Green').sort((a, b) => a - b)
  const red = deal.empressIds.filter(i => msg.plots[i].color === 'Red').sort((a, b) => a - b)
  const yellow = deal.empressIds.filter(i => msg.plots[i].color === 'Yellow').sort((a, b) => a - b)

  console.log('green', green)
  console.log('red', red)
  console.log('yellow', yellow)
  deal.dungeonId = green.shift()
  deal.portfolioIds = [5, green.slice(0, 2), red.slice(0, 2), yellow.slice(0, 2)].flat()
  deal.portfolioIds.sort((a, b) => a - b)
  deal.handIds = deal.portfolioIds.slice()
  deal.reserveIds = deal.handIds.slice(-2)
  deal.handIds = deal.handIds.slice(0, -2)
  deal.timelineIds = deal.empressIds.filter(id => !deal.portfolioIds.includes(id) && deal.dungeonId !== id)
  console.log('handIds', deal.handIds)
  console.log('courtId', deal.courtId)
  console.log('dungeonId', deal.dungeonId)
  console.log('timelineIds', deal.timelineIds)
}

window.setup = msg => {
  const numPlayers = msg.config.numPlayers
  setupCards(msg, numPlayers)
  const tableWidth = numPlayers < 7 ? 3500 : 5000
  const numBottomRowPlayers = Math.round(numPlayers / 2)
  const numTopRowPlayers = numPlayers - numBottomRowPlayers
  const topRowOrigins = getRowOrigins(numTopRowPlayers, -900, tableWidth)
  const bottomRowOrigins = getRowOrigins(numBottomRowPlayers, 900, tableWidth)
  const origins = topRowOrigins.concat(bottomRowOrigins)
  const portfolios = origins.map((origin, i) => {
    const x = origin[0]
    const y = origin[1]
    return describePortfolio(x, y, i)
  }).flat()
  const bank = describeBank(2000, 0)
  const court = describeCourt(-2200, 0)
  const timeline = range(deal.timelineLength).map(i => {
    const offset = deal.timelineLength / 2 - 0.5
    return window.client.describe({ file: 'card/front', x: 0 + (i - offset) * 150, y: 0, type: 'card', cardId: deal.timelineIds[i] })
  })
  const descriptions = [...portfolios, ...bank, ...court, ...timeline]
  console.log('timeline', timeline)
  descriptions.map(x => annotate(x))
  descriptions.sort(compareLayers)
  window.client.start(descriptions, msg)
}
