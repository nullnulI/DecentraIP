const { test } = require('node:test');
const assert = require('node:assert/strict');
const ganache = require('ganache');
const { BrowserProvider, ContractFactory, ZeroAddress, ZeroHash, sha256, toUtf8Bytes } = require('ethers');
const compile = require('../scripts/compile.cjs');

test('IPRegistry end-to-end contract behavior', async t => {
  const rpc = ganache.provider({ logging: { quiet: true } });
  t.after(() => rpc.disconnect());
  const provider = new BrowserProvider(rpc);
  provider.pollingInterval = 20;
  const owner = await provider.getSigner(0);
  const recipient = await provider.getSigner(1);
  const outsider = await provider.getSigner(2);
  const artifact = compile();
  const registry = await new ContractFactory(artifact.abi, artifact.bytecode, owner).deploy();
  await registry.waitForDeployment();
  const hash = sha256(toUtf8Bytes('DecentraIP document'));
  const unknown = sha256(toUtf8Bytes('Unregistered document'));
  let originalTimestamp;

  await t.test('unknown hashes return an absent record', async () => {
    const record = await registry.verifyIP(unknown);
    assert.equal(record.owner, ZeroAddress);
    assert.equal(record.registeredAt, 0n);
    assert.equal(record.exists, false);
  });
  await t.test('registration stores sender, block timestamp, and event', async () => {
    const receipt = await (await registry.registerIP(hash)).wait();
    const record = await registry.verifyIP(hash);
    originalTimestamp = record.registeredAt;
    assert.equal(record.owner, await owner.getAddress());
    assert.equal(record.exists, true);
    assert.equal(record.registeredAt, BigInt((await provider.getBlock(receipt.blockNumber)).timestamp));
    const event = registry.interface.parseLog(receipt.logs[0]);
    assert.equal(event.name, 'IPRegistered');
    assert.equal(event.args.documentHash, hash);
    assert.equal(event.args.owner, await owner.getAddress());
    assert.equal(event.args.timestamp, record.registeredAt);
  });
  await t.test('duplicate registration reverts', async () => {
    await assert.rejects(registry.connect(outsider).registerIP.staticCall(hash), /already registered/);
  });
  await t.test('zero hashes are rejected by all entry points', async () => {
    await assert.rejects(registry.registerIP.staticCall(ZeroHash), /cannot be empty/);
    await assert.rejects(registry.verifyIP(ZeroHash), /cannot be empty/);
    await assert.rejects(registry.transferOwnership.staticCall(ZeroHash, await recipient.getAddress()), /cannot be empty/);
  });
  await t.test('unauthorized and nonexistent-record transfers revert', async () => {
    await assert.rejects(registry.connect(outsider).transferOwnership.staticCall(hash, await recipient.getAddress()), /not the IP owner/);
    await assert.rejects(registry.transferOwnership.staticCall(unknown, await recipient.getAddress()), /not the IP owner/);
  });
  await t.test('zero-address and self-transfers revert', async () => {
    await assert.rejects(registry.transferOwnership.staticCall(hash, ZeroAddress), /zero address/);
    await assert.rejects(registry.transferOwnership.staticCall(hash, await owner.getAddress()), /already the current owner/);
  });
  await t.test('transfer updates owner, emits event, and preserves timestamp', async () => {
    const receipt = await (await registry.transferOwnership(hash, await recipient.getAddress())).wait();
    const record = await registry.verifyIP(hash);
    assert.equal(record.owner, await recipient.getAddress());
    assert.equal(record.registeredAt, originalTimestamp);
    assert.equal(record.exists, true);
    const event = registry.interface.parseLog(receipt.logs[0]);
    assert.equal(event.name, 'OwnershipTransferred');
    assert.equal(event.args.documentHash, hash);
    assert.equal(event.args.previousOwner, await owner.getAddress());
    assert.equal(event.args.newOwner, await recipient.getAddress());
  });
  await t.test('previous owner loses authority and new owner can transfer', async () => {
    await assert.rejects(registry.transferOwnership.staticCall(hash, await outsider.getAddress()), /not the IP owner/);
    await (await registry.connect(recipient).transferOwnership(hash, await outsider.getAddress())).wait();
    assert.equal((await registry.verifyIP(hash)).owner, await outsider.getAddress());
  });
});
