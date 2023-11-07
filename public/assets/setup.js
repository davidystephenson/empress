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
    window.client.describe({ file: 'board/ready', x: x, y: y + sgn * 900, type: 'screen', player: playerIndex }),
    window.client.describe({ file: 'board/nametag', x: x, y: y + sgn * 750, type: 'board' }),
    window.client.describe({ file: 'board/screen', x: x, y: y + sgn * 150, type: 'screen', rotation: angle, player: playerIndex }),
    window.client.describe({ file: 'board/playarea', x: x, y: y - sgn * 400, type: 'board' }),
    window.client.describe({ file: 'board/reserve', x: x, y: y + sgn * 500, type: 'board' })
  ]
  const hand = deal.handIds.map((handId, i) => {
    const space = 160
    return window.client.describe({ file: 'card/front', x: x + (i - 3) * space, y: y + sgn * 150, type: 'card', cardId: handId })
  })
  const gold = [
    ...describeRow('gold/5', x - 220, y - sgn * 150, 'bit', 4, 100),
    ...describeRow('gold/10', x + 130, y - sgn * 150, 'bit', 3, 300)
  ]
  const descriptions = [...boards, ...hand, ...gold]
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
  window.client.describe({ file: 'gold/25', x: x + 260, y: y + 120, type: 'bit', clones: 15 }),
  window.client.describe({ file: 'gold/50', x: x + 440, y: y - 120, type: 'bit', clones: 15 }),
  window.client.describe({ file: 'gold/50', x: x + 440, y: y + 120, type: 'bit', clones: 15 }),
  window.client.describe({ file: 'card/front', x: x + 600, y: y, type: 'card', cardId: 1, clones: 50 })
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
    // console.log('description', description)
    // console.log('plot', plot)
    description.time = plot.time
    description.details = `
      <b>${plot.title}</b><br><br>
      Time: ${plot.time}<br><br>
      Rank: ${plot.rank}<br><br>
      ${plot.beginning}<br><br>
      ${plot.end}<br><br>
      ${plot.threat && plot.threat !== '' ? `<strong>Threat</strong>: ${plot.threat}<br><br>` : ''}
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

const setupCards = (msg, numPlayers) => {
  console.log('msg.plots', msg.plots)
  const shuffledIds = shuffle([...Array(window.plots.length).keys()].filter(i => i !== 7 && i !== 1))
  console.log('shuffle', shuffledIds)
  deal.empressIds = shuffledIds.slice(0, numPlayers + 13)
  console.log('empressIds', deal.empressIds)
  deal.empressIds.sort((a, b) => a - b)
  deal.courtId = deal.empressIds.shift()
  deal.dungeonId = deal.empressIds.shift()
  deal.timelineLength = numPlayers + 5
  const green = deal.empressIds.filter(i => msg.plots[i].color === 'Green').sort((a, b) => a - b)
  const red = deal.empressIds.filter(i => msg.plots[i].color === 'Red').sort((a, b) => a - b)
  const yellow = deal.empressIds.filter(i => msg.plots[i].color === 'Yellow').sort((a, b) => a - b)
  console.log('green', green)
  console.log('red', red)
  console.log('yellow', yellow)
  deal.portfolioIds = [7, green.slice(0, 2), red.slice(0, 2), yellow.slice(0, 1)].flat()
  deal.portfolioIds.push(deal.empressIds.filter(i => !deal.portfolioIds.includes(i))[0])
  deal.portfolioIds.sort((a, b) => a - b)
  deal.handIds = deal.portfolioIds.slice()
  deal.timelineIds = deal.empressIds.filter(i => !deal.portfolioIds.includes(i))
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
