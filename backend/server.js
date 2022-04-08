/* eslint-disable no-console */
/* eslint-disable no-param-reassign */
const express = require('express')

const passport = require('passport')
const mongoose = require('mongoose')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const path = require('path')
const dotenv = require('dotenv').config()

const http = require('http').createServer()
const io = require('socket.io')(http, { cors: { origin: '*' } })

const Game = require('./code/game')
const User = require('./code/user')

const authRouter = require('./routes/auth')

const app = express()
const game = new Game()
game.io = io

const port = 3000
const socketPort = 3001

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static('dist'))
app.use(session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: false,
}))

app.use(passport.authenticate('session'))

app.use('/', authRouter)

// app.use((err, req, res, next) => {
//   if (err) {
//     res.status(500)
//     return next(err)
//   }
//   return next()
// })

io.on('connection', socket => {
  const user = new User(new Date().toISOString(), socket)
  socket.on('startGame', ({ firstName, id }) => {
    user.name = firstName
    user.id = id
    game.users.push(user)
    if (!game.running) {
      game.freshstart = false
      // game.update_user_view(user)
      game.start_game()
    }
  })

  if (game.users.length > game.max_active_users) {
    socket.emit('status', {
      wait: true,
      msg: 'Max players playing',
    })
  } else if (game.running) {
    socket.emit('status', {
      wait: true,
      msg: 'Waiting for next round',
    })
  }

  socket.on('disconnect', () => {
    console.log('User disconnected')
    game.remove_user(socket)
  })

  socket.on('hit', () => {
    console.log('user hit')
    user.socket.emit('status', {
      wait: false,
      msg: 'Your turn',
    })
    game.deal_card(user)
    game.update_user_view()
  })

  socket.on('stand', () => {
    console.log('user stand')
    socket.emit('status', {
      wait: true,
      msg: 'Waiting for other players',
    })
    game.notify_next_player()
  })
})

app.use((err, req, res, next) => {
  if (err) {
    res.status(500)
    return next(err)
  }
  return next()
})

app.get('/favicon.ico', (req, res) => {
  res.status(404).send()
})

app.get('/assets/cards/:name', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/assets/cards', req.params.name))
})

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

http.listen(socketPort, () => {
  console.log(`Socket listening on port ${socketPort}`)
})

app.listen(port, () => {
  console.log(`App running on port ${port}`)
})

// const closeGame = () => {
//   console.log('closing server')
//   io.httpServer.close()
//   http.close()
// }
// process.on('SIGINT', closeGame).on('SIGTERM', closeGame)