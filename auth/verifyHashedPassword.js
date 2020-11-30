// const crypto = require('crypto')
const bcrypt = require('bcryptjs')

// // Function to verify a hashed password with a key derivation function (KDF)
// // If node version is < 10 and the KDF used is Scrypt, then an error is thrown (because Scrypt is not supported in earlier versions of node)
// const verifyHashedPassword = (password, hash) => {
//   return new Promise((resolve, reject) => {
//     const nodeVersion = process.version.split('.')[0].replace('v', '')
//     const [salt, key, kdf] = hash.split(":")

//     if (parseInt(nodeVersion) < 10 && kdf === 'scrypt') {
//       reject(new Error(`Scrypt hashing function is not supported in Node.js version ${process.version}`))
//     } else {
//       if (kdf === 'scrypt') {
//         crypto.scrypt(password, salt, 64, (err, derivedKey) => {
//           if (err) reject(err)
//           resolve(key === derivedKey.toString('hex'))
//         })
//       } else {
//         crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
//           if (err) reject(err)
//           resolve(key === derivedKey.toString('hex'))
//         })
//       }
//     }
//   })
// }

const verifyHashedPassword = (password, hash) => {
  return new Promise((resolve, reject) => {
    bcrypt.compare(password, hash, (err, res) => {
      if (err) reject(err)
      resolve(res)
    })
  })
}

module.exports = verifyHashedPassword
