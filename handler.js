'use strict';

const { promisify } = require('util');
const exec = promisify(require('child_process').exec)
let solanaNameService = require("name-service")
let solana = require("@solana/web3.js");
const base58 = require('bs58')
const connectionDevnet = new solana.Connection(solana.clusterApiUrl('devnet'))
const dotenv = require('dotenv');
dotenv.config();

const AWS = require("aws-sdk")

const region = "us-east-2"

const client = new AWS.SecretsManager({
  region: region
})


async function secrets(secreid) {
  return await new Promise((resolve, reject) => {
    client.getSecretValue({ SecretId: secreid }, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

const get_key = async () => {
  const result = await exec('aws secretsmanager get-secret-value --secret-id nameservice_payer')
  return {
    result: result.stdout
  }
}

async function createName(connection, username, userpubkey, payer) {
  let tx = await solanaNameService.createNameRegistry(connection,
    username,
    10,
    payer.publicKey,
    new solana.PublicKey(userpubkey),
    100)
  let tx2 = new solana.Transaction().add(tx)
  let result = await solana.sendAndConfirmTransaction(connection, tx2, [payer])
  return result;

}


module.exports.nameservice = async (event) => {

  const body = event.body
  const body2 = JSON.parse(body || '')

  let aws_secrets = await secrets(process.env.SECRETID)
  // @ts-ignore
  let secret_string = aws_secrets.SecretString
  let secret_key = JSON.parse(secret_string)
  let payer = solana.Keypair.fromSecretKey(base58.decode(secret_key.name_service_payer));

  // let payer_keypair = await print_key()
  // let reg = /\[|\]/g
  // let rep = payer_keypair.replace(reg, '')
  // let split_keypair = rep.split(",")
  // let length = split_keypair.length;
  // var keypair_array = [];
  // for (var i = 0; i < length; i++)
  //   keypair_array.push(parseInt(split_keypair[i]));
  // const arr = Object.values(keypair_array);
  // const secret = new Uint8Array(arr);

  // let payer = solana.Keypair.fromSecretKey(secret)
  // console.log(payer.publicKey.toBase58())

  let user_name = body2.name;
  let user_pubkey = body2.pubkey;
  let hashed_name = await solanaNameService.getHashedName(user_name)
  let account_key = await solanaNameService.getNameAccountKey(hashed_name);
  let available_main;
  let availableDev;
  let key;

  // checks tha availability of name in devnet

  try {
    let owner = await solanaNameService.getNameOwner(connectionDevnet, account_key)
    key = owner.owner
  } catch (err) {
    if (err == "Error: Unable to find the given account.") {
      availableDev = 1
    } else {
      availableDev = 0
    }
  }
  console.log("available", availableDev)

  if (availableDev) {
    try {
      //devnet name creation
      let result_dev = await createName(connectionDevnet, user_name, user_pubkey, payer)
      return {
        statusCode: 200,
        body: JSON.stringify({
          error: false,
          message: 'New name added',
          data: result_dev
        })
      };

    } catch (error) {
      console.log(error)
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: true,
          message: "error occured",
          data: error
        })
      };
    }
  } else {
    console.log("name already available")
    return {
      statusCode: 200,
      body: JSON.stringify({
        error: true,
        message: 'Username already available',
        data: key
      })
    };
  }


  // return {
  //   statusCode: 200,
  //   body: JSON.stringify({
  //     error: true,
  //    message: 'Username already available',
  //     data: body2.name
  //   })
  // };

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
