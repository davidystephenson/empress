const path = require('path')
const express = require('express')
const app = express()

// SECURE
/*
const fs = require("fs")
const https = require('https')
options = {
  key: fs.readFileSync('sis-key.pem'),
  cert: fs.readFileSync('sis-cert.pem')
}
const server = https.createServer(options,app)
const io = require('socket.io')(server,options)
*/

// INSECURE
const http = require('http')
const socketIo = require('socket.io')
const server = http.Server(app)
const io = socketIo(server)

const csvtojson = require('csvtojson')
app.use(express.static(path.join(__dirname, 'public')))
const state = []
let events = {}
let layers = []
const seed = Math.random().toString()
console.log('seed = ' + seed)

app.get('/', (request, response) =>
  response.sendFile(path.join(__dirname, 'public', 'client.html'))
)

io.on('connection', async socket => {
  const plots = await csvtojson().fromFile('plots.csv')
  console.log('socket.id =', socket.id)
  socket.emit('setup', { seed, state, layers, plots })
  socket.on('updateServer', msg => {
    if (msg.seed === seed) {
      msg.updates.forEach(update => {
        state[update.id] = update
        events[update.id] = { socket, update }
        layers = msg.layers
      })
    }
  })
})

async function updateClients () {
  Object.values(events).forEach(event => {
    const msg = { seed, layers }
    msg.updates = [event.update]
    event.socket.broadcast.emit('updateClient', msg)
  })
  events = {}
}

server.listen(3000, () => {
  const port = server.address().port
  console.log(`listening on port: ${port}`)
})

setInterval(updateClients, 100)
