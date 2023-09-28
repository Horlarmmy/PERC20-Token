const { ethers } = require("hardhat");
const { encryptDataField, decryptNodeResponse } = require("@swisstronik/swisstronik.js");

const sendShieldedTransaction = async (signer, destination, data, value) => {
  // Get the RPC link from the Hardhat network configuration
  const rpcLink = hre.network.config.url;

  // Encrypt transaction data
  const [encryptedData] = await encryptDataField(rpcLink, data);

  // Construct and sign the transaction with encrypted data
  return await signer.sendTransaction({
    from: signer.address,
    to: destination,
    data: encryptedData,
    value,
  });
};

// Obtains PERC20 token balance using ethers wallet and contract instance
const getTokenBalance = async (wallet, contract) => {
  const req = await sendSignedShieldedQuery(
    wallet,
    contract.address,
    contract.interface.encodeFunctionData("balanceOf", [wallet.address]),
  );

  const balance = contract.interface.decodeFunctionResult("balanceOf", req)[0]
  return balance
}

// Sends signed encrypted query to the node
const sendSignedShieldedQuery = async (wallet, destination, data) => {
  if (!wallet.provider) {
      throw new Error("wallet doesn't contain connected provider")
  }

  // Encrypt call data
  const [encryptedData, usedEncryptedKey] = await encryptDataField(
      wallet.provider.connection.url,
      data
  )

  // Get chain id for signature
  const networkInfo = await wallet.provider.getNetwork()
  const nonce = await wallet.getTransactionCount()

  // We treat signed call as a transaction, but it will be sent using eth_call
  const callData = {
      nonce: ethers.utils.hexValue(nonce), // We use nonce to create some kind of reuse-protection
      to: destination,
      data: encryptedData,
      chainId: networkInfo.chainId,
  }

  // Extract signature values
  const signedRawCallData = await wallet.signTransaction(callData)
  const decoded = ethers.utils.parseTransaction(signedRawCallData)

  // Construct call with signature values
  const signedCallData = {
      nonce: ethers.utils.hexValue(nonce), // We use nonce to create some kind of reuse-protection
      to: decoded.to,
      data: decoded.data,
      v: ethers.utils.hexValue(decoded.v),
      r: ethers.utils.hexValue(decoded.r),
      s: ethers.utils.hexValue(decoded.s),
      chainId: ethers.utils.hexValue(networkInfo.chainId)
  }

  // Do call
  const response = await wallet.provider.send('eth_call', [signedCallData, "latest"])

  // Decrypt call result
  return await decryptNodeResponse(wallet.provider.connection.url, response, usedEncryptedKey)
}

async function main() {
  const contractAddress = "0x68444fE18F35051F69996b3544fEaebbC557c45F";
  const account = new ethers.Wallet(
    process.env.PRIVATE_KEY, 
    new hre.ethers.providers.JsonRpcProvider(hre.network.config.url)
  )
  const contractFactory = await ethers.getContractFactory("MyPrivateToken");
  const contract = contractFactory.attach(contractAddress);

  // Minting  token
  const mintTx = await account.sendTransaction({
    to: contract.address,
    value: ethers.utils.parseEther("0.1")
  });
  await mintTx.wait();

  // Getting token balance of user
  const balance = await getTokenBalance(account, contract);
  console.log(`User Balance before transfer ${ethers.utils.formatEther(balance)}`);

  // transfer 1 token to 0x16af037878a6cAce2Ea29d39A3757aC2F6F7aac
  const transferTx = await sendShieldedTransaction(
    account,
    contractAddress,
    contract.interface.encodeFunctionData("transfer", ["0x16af037878a6cAce2Ea29d39A3757aC2F6F7aac1", ethers.utils.parseEther("1")]),
  );
  await transferTx.wait();


  // Getting user balance after transfer
  const balance2 = await getTokenBalance(account, contract);
  console.log(`User Balance after transfer ${ethers.utils.formatEther(balance2)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});