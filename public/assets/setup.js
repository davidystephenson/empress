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

const describePortfolio = (x, y, portfolioIds, player) => {
  const sgn = Math.sign(y)
  const angle = sgn === -1 ? 180 : 0
  const boards = [
    window.client.describe({ file: 'board/ready', x: x, y: y + sgn * 820, type: 'screen', player: player }),
    window.client.describe({ file: 'board/nametag', x: x, y: y + sgn * 680, type: 'board' }),
    window.client.describe({ file: 'board/screen', x: x, y: y + sgn * 400, type: 'screen', rotation: angle, player: player }),
    window.client.describe({ file: 'stack/discard', x: x - 500, y: y + sgn * 0, type: 'discard', targetDeck: player }),
    window.client.describe({ file: 'stack/deck', x: x + 500, y: y + sgn * 0, type: 'deck', deckId: player }),
    window.client.describe({ file: 'board/playarea', x: x, y: y - sgn * 400, type: 'board' })
  ]
  const piles = [
    window.client.describe({ file: 'card/front', x: x - 500, y: y - 20, type: 'card', cardId: deal.discardId }),
    window.client.describe({ file: 'card/front', x: x + 500, y: y - 20, type: 'card', cardId: deal.deckId, side: 'facedown' })
  ]
  const hand = deal.handIds.map((handId, i) => {
    const space = 160
    return window.client.describe({ file: 'card/front', x: x + (i - 3) * space, y: y + sgn * 400, type: 'card', cardId: handId })
  })
  const gold = [
    ...describeRow('gold/5', x - 170, y - sgn * 10, 'bit', 4, 200),
    ...describeRow('gold/10', x + 170, y - sgn * 10, 'bit', 3, 200)
  ]
  const descriptions = [...boards, ...piles, ...hand, ...gold]
  return descriptions
}

const describeBank = (x, y) => [
  window.client.describe({ file: 'gold/1', x: x - 240, y: y - 120, type: 'bit', clones: 150 }),
  window.client.describe({ file: 'gold/5', x: x - 80, y: y - 120, type: 'bit', clones: 35 }),
  window.client.describe({ file: 'gold/10', x: x + 100, y: y - 120, type: 'bit', clones: 30 }),
  window.client.describe({ file: 'gold/25', x: x + 300, y: y - 120, type: 'bit', clones: 15 }),
  window.client.describe({ file: 'gold/1', x: x - 240, y: y + 120, type: 'bit', clones: 150 }),
  window.client.describe({ file: 'gold/5', x: x - 80, y: y + 120, type: 'bit', clones: 35 }),
  window.client.describe({ file: 'gold/10', x: x + 100, y: y + 120, type: 'bit', clones: 30 }),
  window.client.describe({ file: 'gold/25', x: x + 300, y: y + 120, type: 'bit', clones: 15 }),
  window.client.describe({ file: 'card/front', x: x + 600, y: y, type: 'card', cardId: 1, clones: 15 })
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
    description.details = `
      <b>${plot.title}</b><br><br>
      Power: ${plot.power}<br><br>
      Time: ${plot.time}<br><br>
      ${plot.beginning}<br><br>
      ${plot.end}<br><br>
      Color: ${plot.color}<br><br>
      <a href="${plot.link1}" target="_blank">${plot.link1}</a><br><br>
      <a href="${plot.link2}" target="_blank">${plot.link2}</a><br><br>
      `
  }
  switch (description.file) {
    case 'stack/discard':
      description.details = 'Discard'
      break
    case 'stack/deck':
      description.details = 'Deck'
      break
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

const setupCards = (numPlayers) => {
  deal.timelineLength = numPlayers + 5
  deal.deckIds = shuffle([...Array(window.plots.length).keys()].filter(i => i > 1))
  deal.portfolioIds = range(6).map(i => deal.deckIds[i]).concat(0)
  deal.portfolioIds.sort((a, b) => a - b)
  deal.handIds = range(5).map(i => deal.portfolioIds[i])
  deal.discardId = deal.portfolioIds[5]
  deal.deckId = deal.portfolioIds[6]
  deal.timelineLength = numPlayers + 5
  deal.globalIds = range(deal.timelineLength + 2).map(i => deal.deckIds[7 + i])
  deal.globalIds.sort((a, b) => a - b)
  deal.courtId = deal.globalIds[0]
  deal.dungeonId = deal.globalIds[1]
  deal.timelineIds = range(deal.timelineLength).map(i => deal.globalIds[2 + i])

  console.log('handIds', deal.handIds)
  console.log('discardId', deal.discardId)
  console.log('deckId', deal.deckId)
  console.log('courtId', deal.courtId)
  console.log('dungeonId', deal.dungeonId)
  console.log('timelineIds', deal.timelineIds)
}

window.setup = msg => {
  const numPlayers = msg.config.numPlayers
  setupCards(numPlayers)
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
  descriptions.map(x => annotate(x))
  descriptions.sort(compareLayers)
  window.client.start(descriptions, msg)
}
