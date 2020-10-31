const dotenv = require('dotenv')
dotenv.config()
const express = require('express')
const bodyParser = require('body-parser')
const redis = require('redis')
const { MongoClient, ObjectID } = require('mongodb')
const { validateJsonSchema, signJWT, verifyJWT } = require('@fundaciobit/express-middleware')
const { redisGet, redisSet, redisDel, mongoFindOne, mongoInsertOne, mongoUpdateOne, mongoDeleteOne } = require('@fundaciobit/express-redis-mongo')
const { mongodbUri, db, dataGridsCol, usersCol, serverPort } = require('./server.config')
const dataGridSchema = require('./schemas/dataGridSchema')
const loginSchema = require('./schemas/loginSchema')

const secret = process.env.SECRET_KEY

const REDIS_DB_INDEX = 0
const client = redis.createClient({ db: REDIS_DB_INDEX })

class AuthenticationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AuthenticationError'
    this.statusCode = 401
  }
}

// Open MongoDB connection
MongoClient.connect(mongodbUri, { useUnifiedTopology: true, poolSize: 10 })
  .then(client => {
    console.log('Connected to MongoDB...')
    createApp(client)
  })
  .catch(err => {
    console.log(err.message)
    process.exit(1)
  })

const createApp = (mongoClient) => {
  const app = express()
  app.use(bodyParser.json())

  // Login
  // ------
  app.post('/login',
    validateJsonSchema({ schema: loginSchema, instanceToValidate: (req) => req.body }),
    mongoFindOne({ mongoClient, db, usersCol, query: (req) => ({ username: req.body.username, password: req.body.password }), responseProperty: 'user' }),
    (req, res, next) => {
      const { user } = res.locals
      if (user) {
        req.user = { username: user.username }
        next()
      } else {
        throw new AuthenticationError(`Invalid credentials for user: ${req.body.username}`)
      }
    },
    signJWT({ payload: (req) => ({ username: req.user.username }), secret, signOptions: { expiresIn: '24h' } }),
    (req, res) => { res.status(200).json({ token: req.token }) }
  )

  app.use(verifyJWT({ secret }))

  // Create data grid
  // -----------------
  app.post('/data-grids',
    validateJsonSchema({ schema: dataGridSchema, instanceToValidate: (req) => req.body }),
    mongoInsertOne({ mongoClient, db, dataGridsCol, docToInsert: (req, res) => req.body }),
    (req, res) => { res.status(200).json({ _id: res.locals.insertedId }) }
  )

  // Read data grid
  // ---------------
  app.get('/data-grids/:id',
    redisGet({ client, key: (req) => `/data-grids/${req.params.id}`, parseResults: true }),  // Searching in Redis cache
    (req, res, next) => {
      const { redisValue } = res.locals
      if (redisValue) {
        console.log('Sending Redis cached result...')
        res.status(200).json(redisValue)
      } else {
        next()  // Key not found, proceeding to search in MongoDB...
      }
    },
    mongoFindOne({ mongoClient, db, dataGridsCol, query: (req) => ({ _id: new ObjectID(req.params.id) }) }),
    (req, res, next) => {
      if (res.locals.result) {
        next()
      } else {
        res.status(404).send('Document not found')
      }
    },
    redisSet({ client, key: (req) => `/data-grids/${req.params.id}`, value: (req, res) => JSON.stringify(res.locals.result), expiration: 600 }),  // Caching results in Redis for 10 minutes
    (req, res) => {
      console.log(' ...caching MongoDB result in Redis, sending result...')
      res.status(200).json(res.locals.result)
    })

  // Update data grid (removes cache after updating)
  // ------------------------------------------------
  const dataGridSchemaNoRequired = { ...dataGridSchema }
  delete dataGridSchemaNoRequired.required  // Deleted the 'required' field of the JSON schema to support validation of a subset of fields

  app.patch('/data-grids/:id',
    validateJsonSchema({ schema: dataGridSchemaNoRequired, instanceToValidate: (req) => req.body }),
    mongoUpdateOne({ mongoClient, db, dataGridsCol, filter: (req) => ({ _id: new ObjectID(req.params.id) }), contentToUpdate: (req, res) => req.body }),
    redisDel({ client, key: (req) => `/data-grids/${req.params.id}` }),
    (req, res) => { res.status(200).send('Document successfully updated. Cache removed.') }
  )

  // Delete data grid (removes cache after deleting)
  // ------------------------------------------------
  app.delete('/data-grids/:id',
    mongoDeleteOne({ mongoClient, db, dataGridsCol, filter: (req) => ({ _id: new ObjectID(req.params.id) }) }),
    redisDel({ client, key: (req) => `/data-grids/${req.params.id}` }),
    (req, res) => { res.status(200).send('Document successfully deleted. Cache removed.') }
  )

  app.use((err, req, res, next) => {
    if (!err.statusCode) err.statusCode = 500
    res.status(err.statusCode).send(err.toString())
  })

  app.listen(serverPort, () => { console.log(`Server running on port ${serverPort}...`) })
}