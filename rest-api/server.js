const dotenv = require('dotenv')
dotenv.config()
const express = require('express')
const bodyParser = require('body-parser')
const redis = require('redis')
const { MongoClient, ObjectID } = require('mongodb')
const { validateJsonSchema, signJWT, verifyJWT } = require('@fundaciobit/express-middleware')
const { redisGet, redisSet, redisDel, mongoFind, mongoFindOne, mongoInsertOne, mongoUpdateOne, mongoDeleteOne } = require('@fundaciobit/express-redis-mongo')
const { mongodbUri, db, collection, expiration, port } = require('./server.config')
const { dataGridSchema, loginSchema } = require('./schemas/')
const { AuthenticationError } = require('./errors/')

const secret = process.env.SECRET_KEY
const isDevelopment = process.env.NODE_ENV === 'development'

const REDIS_DB_INDEX = 0
const client = redis.createClient({ db: REDIS_DB_INDEX })

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

  app.get('/', (req, res) => {
    res.status(200).json({ documentation: `https://github.com/Fundacio-Bit/turisme-en-dades/blob/master/README.md` })
  })

  // Login
  // ------
  app.post('/login',
    validateJsonSchema({ schema: loginSchema, instanceToValidate: (req) => req.body }),
    mongoFindOne({ mongoClient, db, collection: 'admins_col', query: (req) => ({ username: req.body.username, password: req.body.password }), responseProperty: 'user' }),
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
    mongoInsertOne({ mongoClient, db, collection, docToInsert: (req, res) => req.body }),
    (req, res) => { res.status(200).json({ _id: res.locals.insertedId }) }
  )

  // Read summary of data grids
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
    mongoFind({ mongoClient, db, collection, query: (req) => ({}), projection: { title: 1 } }),
    redisSet({ client, key: (req) => `/data-grids/summary`, value: (req, res) => JSON.stringify(res.locals.results), expiration }),
    (req, res) => {
      if (isDevelopment) console.log(' ... inserted MongoDB results in Redis')
      res.status(200).json(res.locals.results)
    })

  // Read data grid by id
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

  // Update data grid (removes cache after updating)
  // ------------------------------------------------
  const dataGridSchemaNoRequired = { ...dataGridSchema }
  delete dataGridSchemaNoRequired.required  // Deleted the 'required' field of the JSON schema to support validation of a subset of fields

  app.patch('/data-grids/:id',
    validateJsonSchema({ schema: dataGridSchemaNoRequired, instanceToValidate: (req) => req.body }),
    mongoUpdateOne({ mongoClient, db, collection, filter: (req) => ({ _id: new ObjectID(req.params.id) }), contentToUpdate: (req, res) => req.body }),
    redisDel({ client, key: (req) => `/data-grids/${req.params.id}` }),
    (req, res) => { res.status(200).send('Document successfully updated. Cache removed.') }
  )

  // Delete data grid (removes cache after deleting)
  // ------------------------------------------------
  app.delete('/data-grids/:id',
    mongoDeleteOne({ mongoClient, db, collection, filter: (req) => ({ _id: new ObjectID(req.params.id) }) }),
    redisDel({ client, key: (req) => `/data-grids/${req.params.id}` }),
    (req, res) => { res.status(200).send('Document successfully deleted. Cache removed.') }
  )

  app.use((err, req, res, next) => {
    if (!err.statusCode) err.statusCode = 500
    res.status(err.statusCode).send(err.toString())
  })

  app.listen(port, () => { console.log(`Server running on port ${port}...`) })
}