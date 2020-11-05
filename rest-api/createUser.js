const { MongoClient } = require('mongodb')
const { mongodbUri, db } = require('./server.config')
const collection = 'users_col'

MongoClient.connect(mongodbUri, { useUnifiedTopology: true })
  .then(client => {
    createUser(client)
  })
  .catch(err => {
    console.log(err.toString())
    process.exit(1)
  })

const createUser = (mongoClient) => {
  const user = { username: '...', password: '...', isAdmin: true }

  mongoClient.db(db).collection(collection).insertOne(user)
  .then(result => {
    console.log(`\nUser inserted in MongoDB (collection: ${db}.${collection}) with _id:`, result.insertedId, `\n`)
    return mongoClient.db(db).collection(collection).createIndex({ username: 1 }, { sparse: true, unique: true })
  })
  .then(indexName => {
    process.exit(0)
  })
  .catch(err => {
    console.log(err.toString())
    process.exit(1)
  })
}
