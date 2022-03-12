const numPlayers = 3
const timelineLength = numPlayers + 10
const tableWidth = numPlayers < 7 ? 3500 : 5000
const numBottomRowPlayers = Math.round(numPlayers / 2)
const numTopRowPlayers = numPlayers - numBottomRowPlayers
const topRowOrigins = []
const bottomRowOrigins = []
for (let i = 0; i < numTopRowPlayers; i++) {
  const alpha = (i + 1) / (numTopRowPlayers + 1)
  const x = -tableWidth * alpha + tableWidth * (1 - alpha)
  topRowOrigins.push([x, -900])
}
for (let i = 0; i < numBottomRowPlayers; i++) {
  const alpha = (i + 1) / (numBottomRowPlayers + 1)
  const x = -tableWidth * alpha + tableWidth * (1 - alpha)
  bottomRowOrigins.push([x, 900])
}
const origins = topRowOrigins.concat(bottomRowOrigins)
let deckCount = 0

const shuffle = array => {
  const shuffled = array
    .map(item => ({ value: item, priority: Math.random() }))
    .sort((a, b) => a.priority - b.priority)
    .map(x => x.value)
  return shuffled
}

const describeRow = function (file, x, y, type, n, length, side = 'front') {
  const descriptions = []
  for (let i = 0; i < n; i++) {
    let alpha = 0
    if (n > 1) alpha = i / (n - 1)
    const myX = (x - 0.5 * length) * (1 - alpha) + (x + 0.5 * length) * alpha
    const description = window.client.describe({ file: file, x: myX, y: y, type: type })
    descriptions.push(description)
  }
  return (descriptions)
}

const describePortfolio = (x, y, player) => {
  let descriptions = []
  const sgn = Math.sign(y)
  let angle = 0
  if (sgn === -1) {
    angle = 180
  }
  deckCount += 1
  descriptions = descriptions.concat([
    window.client.describe({ file: 'board/ready', x: x, y: y + sgn * 820, type: 'screen', player: player }),
    window.client.describe({ file: 'board/nametag', x: x, y: y + sgn * 680, type: 'board' }),
    window.client.describe({ file: 'board/screen', x: x, y: y + sgn * 400, type: 'screen', rotation: angle, player: player }),
    window.client.describe({ file: 'stack/discard', x: x - 500, y: y + sgn * 0, type: 'discard', targetDeck: deckCount }),
    window.client.describe({ file: 'stack/deck', x: x + 500, y: y + sgn * 0, type: 'deck', deckId: deckCount }),
    window.client.describe({ file: 'board/playarea', x: x, y: y - sgn * 400, type: 'board' })
  ])
  descriptions = descriptions.concat([
    window.client.describe({ file: 'card/front', x: x - 500, y: y - 20, type: 'card', cardId: 11 }),
    window.client.describe({ file: 'card/front', x: x + 500, y: y - 20, type: 'card', cardId: 2, side: 'facedown' })
  ])
  for (const i of Array(8).keys()) {
    const cardId = i + 3
    descriptions = descriptions.concat([
      window.client.describe({ file: 'card/front', x: x + (i - 3.5) * 120, y: y + sgn * 400, type: 'card', cardId: cardId })
    ])
  }
  descriptions = descriptions.concat(describeRow('gold/1', x, y - sgn * 100, 'bit', 5, 300))
  descriptions = descriptions.concat(describeRow('gold/5', x, y + sgn * 50, 'bit', 3, 300))
  return (descriptions)
}

const describeBank = (x, y) => {
  let descriptions = []
  descriptions = descriptions.concat([
    window.client.describe({ file: 'gold/1', x: x - 240, y: y - 120, type: 'bit', clones: 150 }),
    window.client.describe({ file: 'gold/5', x: x - 80, y: y - 120, type: 'bit', clones: 35 }),
    window.client.describe({ file: 'gold/10', x: x + 80, y: y - 120, type: 'bit', clones: 30 }),
    window.client.describe({ file: 'gold/50', x: x + 240, y: y - 120, type: 'bit', clones: 15 }),
    window.client.describe({ file: 'gold/1', x: x - 240, y: y + 120, type: 'bit', clones: 150 }),
    window.client.describe({ file: 'gold/5', x: x - 80, y: y + 120, type: 'bit', clones: 35 }),
    window.client.describe({ file: 'gold/10', x: x + 80, y: y + 120, type: 'bit', clones: 30 }),
    window.client.describe({ file: 'gold/50', x: x + 240, y: y + 120, type: 'bit', clones: 15 })
  ])
  return (descriptions)
}

const describeCourt = (x, y) => {
  let descriptions = []
  descriptions = descriptions.concat([
    window.client.describe({ file: 'board/court', x: x - 200, y: 0, type: 'board' }),
    window.client.describe({ file: 'card/front', x: x - 200, y: y, type: 'card', cardId: 1 })
  ])
  return (descriptions)
}

const annotate = function (description) {
  description.details = ''
  if (description.type === 'card') {
    const plot = window.plots[description.cardId]
    description.details = `
      <b>${plot.title}</b><br><br>
      ${plot.effect1}<br><br>
      ${plot.effect2}<br><br>
      Time: ${plot.time}<br><br>
      Power: ${plot.power}<br><br>
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

const compareFunction = (a, b) => {
  let aLayer = 0
  let bLayer = 0
  if (a.type === 'board') { aLayer = 1 }
  if (b.type === 'board') { bLayer = 1 }
  if (a.type === 'card') { aLayer = 2 }
  if (b.type === 'card') { bLayer = 2 }
  if (a.type === 'bit') { aLayer = 3 }
  if (b.type === 'bit') { bLayer = 3 }
  if (a.type === 'screen') { aLayer = 4 }
  if (b.type === 'screen') { bLayer = 4 }
  return aLayer - bLayer
}

window.setup = msg => {
  const plots = msg.plots
  console.log(plots)
  let descriptions = []
  origins.forEach((origin, i) => {
    const x = origin[0]
    const y = origin[1]
    const portfolio = describePortfolio(x, y, i)
    descriptions = descriptions.concat(portfolio)
  })
  let deck = [...Array(51).keys()].filter(x => x === 0 || x > 11)
  deck = shuffle(deck)
  const auctionRow = deck.slice(0, timelineLength)
  auctionRow.sort()
  descriptions = descriptions.concat(describeBank(2000, 0))
  descriptions = descriptions.concat(describeCourt(-2000, 0))
  for (const i of Array(timelineLength).keys()) {
    const offset = timelineLength / 2 - 0.5
    descriptions = descriptions.concat([
      window.client.describe({ file: 'card/front', x: 0 + (i - offset) * 150, y: 0, type: 'card', cardId: auctionRow[i] })
    ])
  }
  descriptions.map(x => annotate(x))
  descriptions.sort(compareFunction)
  window.client.start(descriptions, msg)
}
