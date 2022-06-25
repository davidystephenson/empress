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

const describePortfolio = (x, y, player) => {
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
  const discardId = [...Array(window.plots.length).keys()].filter(i => window.plots[i].position === 'discard')[0]
  const deckId = [...Array(window.plots.length).keys()].filter(i => window.plots[i].position === 'deck')[0]
  const piles = [
    window.client.describe({ file: 'card/front', x: x - 500, y: y - 20, type: 'card', cardId: discardId }),
    window.client.describe({ file: 'card/front', x: x + 500, y: y - 20, type: 'card', cardId: deckId, side: 'facedown' })
  ]
  const handIds = [...Array(window.plots.length).keys()].filter(i => window.plots[i].position === 'hand')
  const hand = handIds.map((handId, i) => {
    const space = 160
    return window.client.describe({ file: 'card/front', x: x + (i - 3) * space, y: y + sgn * 400, type: 'card', cardId: handId })
  })
  const gold = [
    ...describeRow('gold/1', x, y - sgn * 100, 'bit', 5, 300),
    ...describeRow('gold/5', x, y + sgn * 50, 'bit', 1, 0)
  ]
  const descriptions = [...boards, ...piles, ...hand, ...gold]
  return descriptions
}

const describeBank = (x, y) => [
  window.client.describe({ file: 'gold/1', x: x - 240, y: y - 120, type: 'bit', clones: 150 }),
  window.client.describe({ file: 'gold/5', x: x - 80, y: y - 120, type: 'bit', clones: 35 }),
  window.client.describe({ file: 'gold/10', x: x + 80, y: y - 120, type: 'bit', clones: 30 }),
  window.client.describe({ file: 'gold/50', x: x + 240, y: y - 120, type: 'bit', clones: 15 }),
  window.client.describe({ file: 'gold/1', x: x - 240, y: y + 120, type: 'bit', clones: 150 }),
  window.client.describe({ file: 'gold/5', x: x - 80, y: y + 120, type: 'bit', clones: 35 }),
  window.client.describe({ file: 'gold/10', x: x + 80, y: y + 120, type: 'bit', clones: 30 }),
  window.client.describe({ file: 'gold/50', x: x + 240, y: y + 120, type: 'bit', clones: 15 }),
  window.client.describe({ file: 'card/front', x: x + 600, y: y, type: 'card', cardId: 1, clones: 15 })
]

const describeCourt = (x, y) => {
  const courtId = [...Array(window.plots.length).keys()].filter(i => window.plots[i].position === 'court')[0]
  const dungeonId = [...Array(window.plots.length).keys()].filter(i => window.plots[i].position === 'dungeon')[0]
  return [
    window.client.describe({ file: 'board/court', x: x, y: 0, type: 'board' }),
    window.client.describe({ file: 'card/front', x: x, y: y - 150, type: 'card', cardId: courtId }),
    window.client.describe({ file: 'card/front', x: x, y: y + 150, type: 'card', cardId: dungeonId })
  ]
}

const annotate = function (description) {
  description.details = ''
  if (description.type === 'card') {
    const plot = window.plots[description.cardId]
    description.time = plot.time
    description.details = `
      <b>${plot.title}</b><br><br>
      Time: ${plot.time}<br><br>
      ${plot.beginning}<br><br>
      ${plot.end}<br><br>
      Power: ${plot.power}<br><br>
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

window.setup = msg => {
  const numPlayers = msg.config.numPlayers
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
  const deckIds = shuffle([...Array(window.plots.length).keys()].filter(i => window.plots[i].position === 'timeline'))
  const timelineLength = numPlayers + 5
  const timelineIds = deckIds.slice(0, timelineLength).map(x => Number(x))
  timelineIds.sort((a, b) => a - b)
  const timeline = range(timelineLength).map(i => {
    const offset = timelineLength / 2 - 0.5
    return window.client.describe({ file: 'card/front', x: 0 + (i - offset) * 150, y: 0, type: 'card', cardId: timelineIds[i] })
  })
  const descriptions = [...portfolios, ...bank, ...court, ...timeline]
  descriptions.map(x => annotate(x))
  descriptions.sort(compareLayers)
  window.client.start(descriptions, msg)
}
