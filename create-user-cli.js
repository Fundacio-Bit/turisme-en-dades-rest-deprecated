const dotenv = require('dotenv')
dotenv.config()
const { program } = require('commander')
const { MongoClient } = require('mongodb')
const { mongodbUri, db } = require('./server.config')
const crypto = require('crypto')
const collection = 'users_col'

// Function to hash a password with a key derivation function (KDF)
// If node version is >= 10 then it is used Scrypt as KDF, else it is used PBKDF2 (because Scrypt is not supported in earlier versions of node)
const hashPassword = (password) => {
  const nodeVersion = process.version.split('.')[0].replace('v', '')

  const kdf = (parseInt(nodeVersion) >= 10) ? 'scrypt' : 'pbkdf2'

  const salt = crypto.randomBytes(16).toString('hex')

  const derivedKey = (kdf === 'scrypt')
    ? crypto.scryptSync(password, salt, 64).toString('hex')
    : crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')

  return `${salt}:${derivedKey}:${kdf}`  // this will be the password stored in MongoDB
}

program
  .version('1.0.0')
  .requiredOption('-u, --username <username>', 'user name')
  .requiredOption('-p, --password <password>', 'user password')
  .option('-a, --is-admin', 'user has role of administrator (optional)')

program.parse(process.argv)

const { username, password } = program

if (password.length < 6 || password.length > 20) {
  console.log(`Error: 'password' must have a length between 6 and 20 chars.`)
  process.exit(1)
}

const user = { username, password: hashPassword(password) }
if (program.isAdmin) user.isAdmin = true
console.log('User:', user)

// Connect to MongoDB and insert user
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
