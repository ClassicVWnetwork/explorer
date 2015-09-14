import HTTPError from '../lib/HTTPError.js'
import p from 'path'
import util from 'util'

let debug = require('debug')('explorer:middlewares:user')

function isValidForKey(path) {
  return path == '/' || path == '/download' || path == '/search'
}

function getUser(app) {
  let config = app.get('config')

  /**
   * Middleware that handles the user cookie
   * on error end @see HTTPError
   * on success populates req.user 
   */
  return function userMiddleware(req, res, next) {

    let locals =  {}
    let user = req.cookies.user

    let isKeyAllowed = config.allowKeyAccess.some(e => e == req.path)

    if((!user || !user.username) && req.query.key && isKeyAllowed) {
      user = req.user = req.users.getByKey(req.query.key) 
      
      if(!req.user) {
        return res.status(401).send('Key is not valid')
      }
    }

    if(req.url != '/login' && (!user || !user.username)) {
      if(req.url == '/')
        return res.redirect('/login')
      else
        return next(new HTTPError("Not authenticated", 401, '/login'))
    } 
    
    if(user && user.username && !req.user) {
      req.user = req.users.get(user.username)

      //has a bad cookie
      if(!req.user) {
        res.cookie('user', {}, util._extend({}, {httpOnly: false}, {expires: -1}))
        return next(new HTTPError("Bad cookie", 400, '/login'))
      }

      //populating locals
      for(let i in req.user) {
        if(i != 'password')
          locals[i] = req.user[i]
      }

    }

    debug('User %o', user)

    res.locals.user = locals

    return next()
  } 

}

export default getUser
