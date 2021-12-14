const LPY = artifacts.require("LPY");
module.exports = async function (deployer, network, accounts) {
  const [admin] = accounts

  await deployer.deploy(LPY);

  // const lpy = await LPY.deployed();
  // console.log(await lpy.address)
};
