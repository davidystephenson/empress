const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const path = require('path')
const app = express()
const server = http.Server(app)
const io = socketIo(server)

const csvtojson = require('csvtojson')
app.use(express.static(path.join(__dirname, 'public')))

const state = []
const layers = []
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
    const socketIds = Object.keys(io.sockets.connected)
    msg.updates.forEach(update => {
      state[update.id] = update
    })
    socketIds
      .filter(socketId => socketId !== socket.id)
      .forEach(socketId => {
        msg.seed = seed
        const otherSocket = io.sockets.connected[socketId]
        otherSocket.emit('updateClient', msg)
      })
  })
})

server.listen(3000, () => {
  const port = server.address().port
  console.log(`listening on port: ${port}`)
})
