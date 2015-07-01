var express = require('express')
var app = express()
var p = require('path')
var util = require('util')
var hamljs = require('hamljs')
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')
var session = require('express-session')
var flash = require('connect-flash')
var methodOverride = require('method-override')
var debug = require('debug')('explorer:server')
var Promise = require('bluebird')

import {Users} from './lib/users.js'
import * as routes from './routes'

module.exports = function(config) {

  app.use(bodyParser.urlencoded({extended: false}))
  app.use(bodyParser.json())

  app.use(methodOverride(function(req, res) {
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
      // look in urlencoded POST bodies and delete it
      var method = req.body._method
      delete req.body._method
      return method
    }
  }))

  app.use(cookieParser())
  //sessions are only used for flash
  app.use(session({secret: config.session_secret, resave: false, saveUninitialized: false}))
  app.use(flash())
  app.use(express.static('client'))
  app.set('config', config)
  app.set('view engine','haml' )

  app.engine('.haml', function(str, options, fn) {
    options.locals = util._extend({}, options)
    //debug('template locals', options.locals)
    return hamljs.renderFile(str, 'utf-8', options, fn)
  })

  app.use(function(req, res, next) {
    res.renderBody = function(name, locals) {
      locals = util._extend(res.locals, locals ? locals : {})

      app.render(name, locals, function(err, body) {
        return res.render('index.haml', util._extend(locals, {body: body}))
      }) 
    }

    req.config = config
    req.users = users

    res.locals.app_root = config.app_root ? config.app_root : '/'

    res.locals.messages = {
      info: req.flash('info'),
      error: req.flash('error')
    }

    return next()
  })

  app.use(function(req, res, next) {

    let user = req.cookies.user

    if((!user || !user.username) && req.query.key) {
      user = req.user = users.getByKey(req.query.key) 
      
      if(!req.user) {
        return res.status(401).send('Key is not valid')
      }
    }

    if(req.url != '/login' && (!user || !user.username)) {
      return res.redirect('/login') 
    } 
    
    if(user && user.username && !req.user) {
      req.user = users.get(user.username)

      //has a bad cookie
      if(!req.user) {
        res.cookie('user', {}, util._extend({}, {httpOnly: false}, {expires: -1}))
        return res.redirect('/login')
      }
    }

    res.locals.user = req.user || {}

    debug('User %o', user)

    return next()
  })

  //Load routes
  routes.Tree(app)
  routes.User(app)
  routes.Settings(app)
  routes.Admin(app)

  //key?
  app.get('/rss', function(req, res) {

    if(!req.query.key)
      return res.send(401, 'Authentication failed')
    res.send('rss')
  })

  //where is this ES6 feature?
  var users = new Users({database: p.resolve(__dirname, config.database)})

  //load users from file to memory
  return users.load()
  .then(err => console.log('Db loaded'))
  .then(e => Promise.resolve(app))
}
