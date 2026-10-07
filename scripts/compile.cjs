const fs = require('node:fs');
const path = require('node:path');
const solc = require('solc');
const root = path.join(__dirname, '..');
function compile() {
  const input = {
    language: 'Solidity',
    sources: { 'IPRegistry.sol': { content: fs.readFileSync(path.join(root, 'contracts/IPRegistry.sol'), 'utf8') } },
    settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter(e => e.severity === 'error');
  if (errors.length) throw new Error(errors.map(e => e.formattedMessage).join('\n'));
  const result = output.contracts['IPRegistry.sol'].IPRegistry;
  return { contractName: 'IPRegistry', compiler: solc.version(), abi: result.abi, bytecode: '0x' + result.evm.bytecode.object };
}
module.exports = compile;
if (require.main === module) {
  const artifact = compile();
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'artifacts/IPRegistry.json'), JSON.stringify(artifact, null, 2) + '\n');
  console.log('Compiled IPRegistry with ' + artifact.compiler);
}
