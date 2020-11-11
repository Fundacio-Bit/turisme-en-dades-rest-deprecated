const { program } = require('commander')
const { MongoClient } = require('mongodb')
const { mongodbUri, db } = require('./server.config')
const collection = 'users_col'

program
  .version('1.0.0')
  .requiredOption('-u, --username <username>', 'user name')
  .requiredOption('-p, --password <password>', 'user password')
  .option('-a, --is-admin', 'user has role of administrator')

program.parse(process.argv)

let { username, password } = program
const user = { username, password }

if (program.isAdmin) user.isAdmin = true

if (password.length < 6 || password.length > 20) {
  console.log(`Error: 'password' must have a length between 6 and 20 chars.`)
  process.exit(1)
}

console.log('User:', user)

MongoClient.connect(mongodbUri, { useUnifiedTopology: true })
  .then(client => {
    createUser(client)
  })
  .catch(err => {
    console.log(err.toString())
    process.exit(1)
  })

const createUser = (mongoClient) => {
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
