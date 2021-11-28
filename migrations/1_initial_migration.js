const MRK = artifacts.require("MRK");
module.exports = async function (deployer, network, accounts) {
  const [admin] = accounts

  await deployer.deploy(MRK);

  // const mrk = await MRK.deployed();
  // console.log(await mrk.address)
};
