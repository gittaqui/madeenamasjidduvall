const { getTableClient } = require('../shared/tableClient');

module.exports = async function (context, req){
  const token = (req.query.token||'').trim();
  // Deprecated: confirmation moved to external Function App.
  module.exports = async function(context){
    context.res = { status:410, body:{ ok:false, deprecated:true, message:'/api/confirm moved to external Function App', newBase:'https://madeena-rsvp-api.azurewebsites.net/api' } };
  };
};