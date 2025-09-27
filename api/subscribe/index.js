const crypto = require('crypto');
const { getTableClient } = require('../shared/tableClient');

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/i;
function sha256Hex(v){ return crypto.createHash('sha256').update(v,'utf8').digest('hex'); }
function randomToken(){ return crypto.randomBytes(24).toString('hex'); }

  // Deprecated: subscription functionality moved to external Function App.
  module.exports = async function(context){
    context.res = { status:410, body:{ ok:false, deprecated:true, message:'/api/subscribe moved to external Function App', newBase:'https://madeena-rsvp-api.azurewebsites.net/api' } };
  };