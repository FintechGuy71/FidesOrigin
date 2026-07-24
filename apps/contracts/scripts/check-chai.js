const chai = require('chai');
console.log('chai path:', require.resolve('chai'));
const expect = chai.expect;
try {
  expect({}).to.changeEtherBalance;
  console.log('changeEtherBalance: available');
} catch(e) {
  console.log('changeEtherBalance error:', e.message.substring(0, 100));
}
try {
  expect({}).to.revertedWith;
  console.log('revertedWith: available');
} catch(e) {
  console.log('revertedWith error:', e.message.substring(0, 100));
}
try {
  expect(Promise.resolve(1)).to.eventually.equal(1);
  console.log('eventually: available');
} catch(e) {
  console.log('eventually error:', e.message.substring(0, 100));
}
