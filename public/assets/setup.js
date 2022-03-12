var numPlayers = 3
var timelineLength = numPlayers+10
var tableWidth = numPlayers<7 ? 3500 : 5000
var numBottomRowPlayers = Math.round(numPlayers/2)
var numTopRowPlayers = numPlayers-numBottomRowPlayers
var topRowOrigins = []
var bottomRowOrigins = []
for(i=0; i<numTopRowPlayers; i++) {
  var alpha = (i+1)/(numTopRowPlayers+1)
  var x = -tableWidth*alpha+tableWidth*(1-alpha)
  topRowOrigins.push([x,-900])
}
for(i=0; i<numBottomRowPlayers; i++) {
  var alpha = (i+1)/(numBottomRowPlayers+1)
  var x = -tableWidth*alpha+tableWidth*(1-alpha)
  bottomRowOrigins.push([x,900])
}
origins = topRowOrigins.concat(bottomRowOrigins)
deckCount = 0

shuffle = array => {
  let shuffled = array
    .map(item => ({ value: item, priority: Math.random() }))
    .sort((a, b) => a.priority - b.priority)
    .map(x => x.value)
  return shuffled
}

const describeRow = function(file,x,y,type,n,length,side='front') {
  let descriptions = []
  for(i=0; i<n; i++) {
    var alpha = 0
    if(n>1) alpha = i/(n-1)
    var myX = (x-0.5*length)*(1-alpha) + (x+0.5*length)*alpha
    description = window.client.describe({file:file,x:myX,y:y,type:type})
    descriptions.push(description)
  }
  return(descriptions)
}

const describeColumn = function(file,x,y,type,n,length,side='front') {
  let descriptions = []
  for(i=0; i<n; i++) {
    var alpha = 0
    if(n>1) alpha = i/(n-1)
    var myY = (y-0.5*length)*(1-alpha) + (y+0.5*length)*alpha
    description = client.describe({file:file,x:x,y:myY,type:type,side:side})
    descriptions.push(description)
  }
  return(descriptions)
}

const describePortfolio = (x,y,player) => {
  let descriptions = []
  let sgn = Math.sign(y)
  offset = 0
  angle = 0
  if(sgn==-1) {
    angle = 180
    offset = 1
  }
  deckCount += 1
  descriptions = descriptions.concat([
    client.describe({file:'board/ready',x:x+000,y:y+sgn*820,type:'screen',player:player}),
    client.describe({file:'board/nametag',x:x+000,y:y+sgn*680,type:'board'}),
    client.describe({file:'board/screen',x:x-000,y:y+sgn*400,type:'screen',rotation:angle,player:player}),
    client.describe({file:'stack/discard',x:x-500,y:y+sgn*000,type:'discard',targetDeck:deckCount}),
    client.describe({file:'stack/deck'   ,x:x+500,y:y+sgn*000,type:'deck',deckId:deckCount}),
    client.describe({file:'board/playarea',x:x+000,y:y-sgn*400,type:'board'}),
  ])
  var yStack = sgn==1 ? -20 : -20
  descriptions = descriptions.concat([
    client.describe({file:'card/front',x:x-500,y:y-20,type:'card',cardId:11}),
    client.describe({file:'card/front',x:x+500,y:y-20,type:'card',cardId:2,side:'facedown'}),
  ])
  for(i of Array(8).keys()) {
    var cardId = i+3
    descriptions = descriptions.concat([
      client.describe({file:'card/front',x:x+(i-3.5)*120,y:y+sgn*400,type:'card',cardId:cardId})
    ])
  }
  descriptions = descriptions.concat(describeRow('gold/1',x,y-sgn*100,'bit',5,300))
  descriptions = descriptions.concat(describeRow('gold/5',x,y+sgn*50,'bit',3,300))
  return(descriptions)
}

const describeBank = (x,y) => {
  let descriptions = []
  descriptions = descriptions.concat([
    client.describe({file:'gold/1',   x:x-240,y:y-120,type:'bit',clones:150}),
    client.describe({file:'gold/5',   x:x-080,y:y-120,type:'bit',clones:35}),
    client.describe({file:'gold/10',  x:x+080,y:y-120,type:'bit',clones:30}),
    client.describe({file:'gold/50',  x:x+240,y:y-120,type:'bit',clones:15}),
    client.describe({file:'gold/1',   x:x-240,y:y+120,type:'bit',clones:150}),
    client.describe({file:'gold/5',   x:x-080,y:y+120,type:'bit',clones:35}),
    client.describe({file:'gold/10',  x:x+080,y:y+120,type:'bit',clones:30}),
    client.describe({file:'gold/50',  x:x+240,y:y+120,type:'bit',clones:15}),
  ])
  return(descriptions)
}

const describeCourt = (x,y) => {
  let descriptions = [] 
  descriptions = descriptions.concat([
    client.describe({file:'board/court',x:x-200,y:0,type:'board'}),
    client.describe({file:'card/front',x:x-200,y:y,type:'card',cardId:1})
  ])
  return(descriptions)
}

const annotate = function(description) {
  description.details = ''
  if(description.type=='card') {
    var plot = plots[description.cardId]
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
  switch( description.file ) {
    case 'stack/discard':
      description.details = 'Discard'
      break;
    case 'stack/deck':
      description.details = 'Deck'
      break;
  }
}

const compareFunction = (a,b) => {
  aLayer = 0
  bLayer = 0
  if(a.type=='board') { aLayer = 1 }
  if(b.type=='board') { bLayer = 1 }
  if(a.type=='card') { aLayer = 2 }
  if(b.type=='card') { bLayer = 2 }
  if(a.type=='bit') { aLayer = 3 }
  if(b.type=='bit') { bLayer = 3 }
  if(a.type=='screen') { aLayer = 4 }
  if(b.type=='screen') { bLayer = 4 }
  return aLayer-bLayer
}

const setup = msg => {
  plots = msg.plots
  console.log(plots)
  let descriptions = []
  origins.map((origin,i) => { 
    x = origin[0]
    y = origin[1]
    const portfolio = describePortfolio(x,y,i) 
    descriptions = descriptions.concat(portfolio)
  })
  deck = [...Array(51).keys()].filter(x=>x==0||x>11)
  deck = shuffle(deck)
  auctionRow = deck.slice(0,timelineLength)
  auctionRow.sort()
  descriptions = descriptions.concat(describeBank(2000,0))
  descriptions = descriptions.concat(describeCourt(-2000,0))
  for(i of Array(timelineLength).keys()) {
    var offset = timelineLength/2-0.5
    descriptions = descriptions.concat([
      client.describe({file:'card/front',x:0+(i-offset)*150,y:0,type:'card',cardId:auctionRow[i]})
    ])
  }
  descriptions.map(x => annotate(x))
  descriptions.sort(compareFunction)
  client.start(descriptions,msg)
}
