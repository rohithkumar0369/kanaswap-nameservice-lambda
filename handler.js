'use strict';

const { promisify } = require('util');
const exec = promisify(require('child_process').exec)
let solana_name_service = require("@solana/spl-name-service")
let solana = require("@solana/web3.js");

const connection_devnet = new solana.Connection(solana.clusterApiUrl('devnet'))
const dotenv = require('dotenv');
dotenv.config();

const get_key = async () => {
  const result = await exec('aws secretsmanager get-secret-value --secret-id nameservice_payer')
  return {
    result: result.stdout
  }
}

async function create_name(connection, user_name, user_pubkey, payer) {
  let tx = await solana_name_service.createNameRegistry(connection,
    user_name,
    10,
    payer.publicKey,
    new solana.PublicKey(user_pubkey),
    100)
  let tx2 = new solana.Transaction().add(tx)
  let result = await solana.sendAndConfirmTransaction(connection, tx2, [payer])
  return result;

}


module.exports.nameservice = async (event) => {

  const body = event.body
  const body2 = JSON.parse(body || '')
  let payer_keypair = await print_key()
  let reg = /\[|\]/g
  let rep = payer_keypair.replace(reg, '')
  let split_keypair = rep.split(",")
  let length = split_keypair.length;
  var keypair_array = [];
  for (var i = 0; i < length; i++)
    keypair_array.push(parseInt(split_keypair[i]));
  const arr = Object.values(keypair_array);
  const secret = new Uint8Array(arr);
  let payer = solana.Keypair.fromSecretKey(secret)
  console.log(payer.publicKey.toBase58())
  let user_name = req.body.name;
  let user_pubkey = req.body.pubkey;
  let hashed_name = await solana_name_service.getHashedName(user_name)
  let account_key = await solana_name_service.getNameAccountKey(hashed_name);
  let available_main;
  let available_dev;
  let key;

  // checks tha availability of name in devnet

  try {
    let owner = await solana_name_service.getNameOwner(connection_devnet, account_key)
    key = owner.owner
  } catch (err) {
    if (err == "Error: Unable to find the given account.") {
      available_dev = 1
    } else {
      available_dev = 0
    }
  }
  console.log("available", available_dev)

  if (available_dev) {
    try {
      //devnet name creation
      let result_dev = await create_name(connection_devnet, user_name, user_pubkey, payer)
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
