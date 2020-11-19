const dotenv = require('dotenv')
dotenv.config()
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const redis = require('redis')
const { MongoClient, ObjectID } = require('mongodb')
const { validateJsonSchema, signJWT, verifyJWT } = require('@fundaciobit/express-middleware')
const { redisGet, redisSet, redisDel, mongoFind, mongoFindOne, mongoInsertOne, mongoUpdateOne, mongoDeleteOne } = require('@fundaciobit/express-redis-mongo')
const { mongodbUri, db, collection, redisHost, redisDBindex, expiration, port } = require('./server.config')
const { AuthenticationError, verifyHashedPassword } = require('./auth')
const { dataGridSchema, loginSchema } = require('./schemas/')

const secret = process.env.SECRET_KEY
const isDevelopment = process.env.NODE_ENV === 'development'

// Open Redis connection
const client = redis.createClient({ host: redisHost, db: redisDBindex })

// Open MongoDB connection
MongoClient.connect(mongodbUri, { useUnifiedTopology: true, poolSize: 10 })
  .then(client => {
    console.log('Connected to MongoDB...')
    createApp(client)
  })
  .catch(err => {
    console.log(err.toString())
    process.exit(1)
  })

const createApp = (mongoClient) => {
  const app = express()
  app.use(bodyParser.json())
  app.use(cors())

  app.use(express.static(path.join(__dirname, 'build')))

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'))
  })

  // app.get('/', (req, res) => {
  //   res.status(200).json({ documentation: `https://github.com/Fundacio-Bit/turisme-en-dades-rest/blob/master/README.md` })
  // })

  // Login
  // ------
  app.post('/login',
    validateJsonSchema({ schema: loginSchema, instanceToValidate: (req) => req.body }),
    mongoFindOne({ mongoClient, db, collection: 'users_col', query: (req) => ({ username: req.body.username }), responseProperty: 'user' }),
    (req, res, next) => {
      const { user } = res.locals
      if (user) {
        verifyHashedPassword(req.body.password, user.password)
          .then(verified => {
            if (verified) {
              req.authenticatedUser = { username: user.username }
              if (user.isAdmin) req.authenticatedUser.isAdmin = user.isAdmin
              next()
            } else {
              next(new AuthenticationError('Invalid password'))
            }
          })
          .catch(err => {
            next(err)
          })
      } else {
        throw new AuthenticationError(`Unknown user: ${req.body.username}`)
      }
    },
    signJWT({ payload: (req) => ({ ...req.authenticatedUser }), secret, signOptions: {} }),
    (req, res) => { res.status(200).json({ token: req.token }) }
  )

  app.use(verifyJWT({ secret }))

  // --- CRUD endpoints ---

  // CREATE data grid
  // -----------------
  app.post('/data-grids',
    (req, res, next) => {
      if (!req.tokenPayload.isAdmin) throw new AuthenticationError(`Only admin users can execute this operation`)
      next()
    },
    validateJsonSchema({ schema: dataGridSchema, instanceToValidate: (req) => req.body }),
    mongoInsertOne({ mongoClient, db, collection, docToInsert: (req, res) => req.body }),
    redisDel({ client, key: (req) => `/data-grids/summary` }),
    (req, res) => { res.status(200).json({ _id: res.locals.insertedId }) }
  )

  // READ summary of data grids
  // ---------------------------
  app.get('/data-grids/summary',
    redisGet({ client, key: (req) => `/data-grids/summary`, parseResults: true }),
    (req, res, next) => {
      const { redisValue } = res.locals
      if (redisValue) {
        if (isDevelopment) console.log('Sending cached results from Redis ...')
        res.status(200).json(redisValue)
      } else {
        next()  // Key not found, proceeding to search in MongoDB...
      }
    },
    mongoFind({ mongoClient, db, collection, query: (req) => ({}), projection: { title: 1, section: 1, month: 1 } }),
    redisSet({ client, key: (req) => `/data-grids/summary`, value: (req, res) => JSON.stringify(res.locals.results), expiration }),
    (req, res) => {
      if (isDevelopment) console.log(' ... inserted MongoDB results in Redis')
      res.status(200).json(res.locals.results)
    })

  // READ data grid BY id
  // ---------------------
  app.get('/data-grids/:id',
    redisGet({ client, key: (req) => `/data-grids/${req.params.id}`, parseResults: true }),
    (req, res, next) => {
      const { redisValue } = res.locals
      if (redisValue) {
        if (isDevelopment) console.log('Sending cached result from Redis ...')
        res.status(200).json(redisValue)
      } else {
        next()  // Key not found, proceeding to search in MongoDB...
      }
    },
    mongoFindOne({ mongoClient, db, collection, query: (req) => ({ _id: new ObjectID(req.params.id) }) }),
    (req, res, next) => {
      if (res.locals.result) {
        next()
      } else {
        res.status(404).send('Document not found')
      }
    },
    redisSet({ client, key: (req) => `/data-grids/${req.params.id}`, value: (req, res) => JSON.stringify(res.locals.result), expiration }),
    (req, res) => {
      if (isDevelopment) console.log(' ... inserted MongoDB result in Redis')
      res.status(200).json(res.locals.result)
    })

  // UPDATE data grid
  // -----------------
  const dataGridSchemaNoRequired = { ...dataGridSchema }
  delete dataGridSchemaNoRequired.required  // Delete the 'required' field of the JSON schema to support validation of a subset of fields

  app.patch('/data-grids/:id',
    (req, res, next) => {
      if (!req.tokenPayload.isAdmin) throw new AuthenticationError(`Only admin users can execute this operation`)
      next()
    },
    validateJsonSchema({ schema: dataGridSchemaNoRequired, instanceToValidate: (req) => req.body }),
    mongoUpdateOne({ mongoClient, db, collection, filter: (req) => ({ _id: new ObjectID(req.params.id) }), contentToUpdate: (req, res) => req.body }),
    redisDel({ client, key: (req) => `/data-grids/${req.params.id}` }),
    redisDel({ client, key: (req) => `/data-grids/summary` }),
    (req, res) => { res.status(200).send('Document successfully updated. Cache removed.') }
  )

  // DELETE data grid
  // -----------------
  app.delete('/data-grids/:id',
    (req, res, next) => {
      if (!req.tokenPayload.isAdmin) throw new AuthenticationError(`Only admin users can execute this operation`)
      next()
    },
    mongoDeleteOne({ mongoClient, db, collection, filter: (req) => ({ _id: new ObjectID(req.params.id) }) }),
    redisDel({ client, key: (req) => `/data-grids/${req.params.id}` }),
    redisDel({ client, key: (req) => `/data-grids/summary` }),
    (req, res) => { res.status(200).send('Document successfully deleted. Cache removed.') }
  )

  app.use((err, req, res, next) => {
    if (!err.statusCode) err.statusCode = 500
    res.status(err.statusCode).send(err.toString())
  })

  app.listen(port, () => { console.log(`Server running on port ${port}...`) })
}