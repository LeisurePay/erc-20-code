const MRK = artifacts.require("MRK");
const {ether, expectEvent, expectRevert, time}  = require("@openzeppelin/test-helpers");

let instance;

contract("MRK", (accounts) => {
  const [admin, alice, bob] = accounts;
  
  beforeEach(async ()=> {
    instance = await MRK.new();
  })

  it('creation: should create an initial balance of totalSupply for the creator', async () => {
    const supply = await instance.totalSupply();
    const adminBal = await instance.balanceOf(admin);
    return expect(supply.toString()).to.equal(adminBal.toString());
  });

  // TRANSERS
  // normal transfers without approvals
  
  it('transfers: should transfer 10000 to alice from admin', async () => {
    await instance.transfer(alice, 10000, { from: admin })
    const balance = await instance.balanceOf(alice)
    assert.strictEqual(balance.toNumber(), 10000)
  })

  it('transfers: should be greater than zero', async () => {
    expectRevert(instance.transfer(alice, 0, { from: admin }), 'Transfer', {from:admin, to:alice, value:0})
  })

  // APPROVALS
  it('approvals: msg.sender should approve 100 to alice', async () => {
    await instance.approve(alice, 100, { from: admin })
    const allowance = await instance.allowance(admin, alice)
    assert.strictEqual(allowance.toNumber(), 100)
  })

  // bit overkill. But is for testing a bug
  it('approvals: msg.sender approves alice of 100 & withdraws 20 once.', async () => {
    await instance.approve(alice, 100, { from: admin }) // 100
    const balance = await instance.balanceOf(bob)
    assert.strictEqual(balance.toNumber(), 0, 'balance not correct')

    await instance.allowance(admin, alice)
    await instance.transferFrom(admin, bob, 20, { from: alice}) // -20
    const allowance01 = await instance.allowance(admin, alice)
    assert.strictEqual(allowance01.toNumber(), 80) // =80

    const balance2 = await instance.balanceOf(bob)
    assert.strictEqual(balance2.toNumber(), 20)

  })

  // should approve 100 of msg.sender & withdraw 20, twice. (should succeed)
  it('approvals: msg.sender approves alice of 100 & withdraws 20 twice.', async () => {
    await instance.approve(alice, 100, { from: admin })
    const allowance01 = await instance.allowance(admin, alice)
    assert.strictEqual(allowance01.toNumber(), 100)

    await instance.transferFrom(admin, bob, 20, { from: alice })
    const allowance012 = await instance.allowance(admin, alice)
    assert.strictEqual(allowance012.toNumber(), 80)

    const balance2 = await instance.balanceOf(bob)
    assert.strictEqual(balance2.toNumber(), 20)

    // FIRST tx done.
    // onto next.
    await instance.transferFrom(admin, bob, 20, { from: alice })
    const allowance013 = await instance.allowance(admin, alice)
    assert.strictEqual(allowance013.toNumber(), 60)

    const balance22 = await instance.balanceOf(bob)
    assert.strictEqual(balance22.toNumber(), 40)
  })

  // should approve 100 of msg.sender & withdraw 50 & 60 (should fail).
  it('approvals: msg.sender approves alice of 100 & withdraws 50 & 60 (2nd tx should fail)', async () => {
    await instance.approve(alice, 100, { from: admin })
    const allowance01 = await instance.allowance(admin, alice)
    assert.strictEqual(allowance01.toNumber(), 100)

    await instance.transferFrom(admin, bob, 50, { from: alice })
    const allowance012 = await instance.allowance(admin, alice)
    assert.strictEqual(allowance012.toNumber(), 50)

    const balance2 = await instance.balanceOf(bob)
    assert.strictEqual(balance2.toNumber(), 50)

    // FIRST tx done.
    // onto next.
    expectRevert.unspecified(instance.transferFrom(admin, bob, 60, { from: alice }))
  })

  it('approvals: attempt withdrawal from account with no allowance (should fail)', async () => {
    expectRevert.unspecified(instance.transferFrom(admin, bob, 60, { from: alice }))
  })

  it('approvals: allow alice 100 to withdraw from admin. Withdraw 60 and then approve 0 & attempt transfer.', async () => {
    await instance.approve(alice, 100, { from: admin })
    await instance.transferFrom(admin, bob, 60, { from: alice })
    await instance.approve(alice, 0, { from: admin })
    
    expectRevert.unspecified(instance.transferFrom.call(admin, bob, 10, { from: alice }))
    
  })

  // EVENTS
  /* eslint-disable no-underscore-dangle */
  it('events: should fire Transfer event properly', async () => {
    const res = await instance.transfer(alice, '2666', { from: admin })
    expectEvent(res, 'Transfer', {from:admin, to:alice, value:'2666'})
  })

  it('events: should fire Approval event properly', async () => {
    const res = await instance.approve(alice, '2666', { from: admin })
    expectEvent(res, 'Approval', {owner:admin, spender:alice, value:'2666'})
  })

  // Ownable
  it("onlyOwner: should change router", async function () {
    await expectRevert(instance.changeRouter(bob,{from:alice}), "Ownable: caller is not the owner")
  });

  it("onlyOwner: should exclude from reward", async function () {
    expectRevert(instance.excludeFromReward(bob,{from:alice}), "Ownable: caller is not the owner")

    await instance.excludeFromReward(bob, {from:admin});
    const excluded = await instance.isExcludedFromReward(bob);

    expect(excluded).to.be.true;
  });

  it("onlyOwner: should include in reward", async function () {
    await expectRevert(instance.includeInReward(bob,{from:alice}), "Ownable: caller is not the owner")

    await expectRevert(instance.includeInReward(bob, {from:admin}), "Account is already excluded");
  });

  it("onlyOwner: should exclude from fee", async function () {
    expectRevert(instance.excludeFromFee(bob,{from:alice}), "Ownable: caller is not the owner")

    await instance.excludeFromFee(bob, {from:admin});
    const excluded = await instance.isExcludedFromFee(bob);

    expect(excluded).to.be.true;
  });

  it("onlyOwner: should include in fee", async function () {
    await expectRevert(instance.includeInFee(bob,{from:alice}), "Ownable: caller is not the owner")

    await instance.includeInFee(bob, {from:admin});
    expect(await instance.isExcludedFromFee(bob, {from:admin})).to.be.false;
  });

  // taxes
  it("anti dump: should spend <= 30% in a day", async function () {
    await instance.transfer(alice,100, {from:admin});
    await instance.transfer(bob,30, {from:alice});
    
    // Greater than 30%
    await expectRevert.unspecified(instance.transfer(bob,30, {from:alice}));

    const latest = await time.latest();

    // jump to a day ahead
    await time.increaseTo(latest.add(time.duration.days(1)));

    const res = await instance.transfer(bob, 30, { from: alice })
    expectEvent(res, 'Transfer', { from: alice, to: bob, value: '30' });

    expect((await instance.balanceOf(bob)).toString()).to.be.equal('60');
  })

  it("anti dump: should not spend > 30% in a day", async function () {
    await instance.transfer(alice, 100, { from: admin });
    await instance.transfer(bob, 30, { from: alice });

    // Greater than 30%
    await expectRevert.unspecified(instance.transfer(bob, 30, { from: alice }));
    expect((await instance.balanceOf(bob)).toString()).to.be.equal("30");
  })

  // fees
  it("Fees: should change once in 180 days", async function () {
    await instance.updateFees(4, 5, 2, { from: admin });

    // New change in  than 180 days
    await expectRevert(
      instance.updateFees(4, 5, 2, { from: admin }),
      "Tax change interval has not reached"
    );

    const latest = await time.latest();

    // jump to 6 months ahead
    await time.increaseTo(latest.add(time.duration.days(180)));

    // Works
    await instance.updateFees(4, 5, 2, { from: admin })
  });

  it("Fees: should not change greater than 6%", async function () {
    // fail
    await expectRevert(
      instance.updateFees(7, 6, 9, { from: admin }),
      "Fees must not be greater than 6"
    );
  });

  it("Fees: no time limit for decrease", async function () {

    await instance.updateFees(6, 6, 6, { from: admin })

    await instance.updateFees(4, 4, 4, { from: admin })
    await instance.updateFees(1, 1, 1, { from: admin })

    await expectRevert(
      instance.updateFees(2, 2, 2, { from: admin }),
      "Tax change interval has not reached"
    );
  });

});
